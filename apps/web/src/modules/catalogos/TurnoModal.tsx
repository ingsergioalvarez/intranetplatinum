import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Clock, Trash2 } from 'lucide-react';
import {
  HORAS_SUGERIDAS,
  ROLES,
  textoDias,
  turnoSchema,
  type DiasTurno,
  type TurnoCatalogo,
} from '@platinum/shared';
import { mensajeDeError } from '../../core/api';
import { useAuthStore } from '../../core/auth/authStore';
import { Button, ConfirmDialog, FormField, FormModal, Input, cn, toast } from '../../components/ui';
import { sitiosService } from '../clientes/clientes.service';
import { nombreSugerido, textoHorario } from './turnos.texto';
import { turnosService } from './turnos.service';

const SEMANA = [
  [1, 'L'],
  [2, 'M'],
  [3, 'M'],
  [4, 'J'],
  [5, 'V'],
  [6, 'S'],
  [0, 'D'],
] as const;
const NOMBRE_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

type TipoDias = DiasTurno['tipo'] | 'unoYUno';

const boton = (activo: boolean) =>
  cn(
    'rounded-lg border-2 px-3 py-2 text-sm font-medium',
    activo ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600',
  );

/**
 * Alta / edición de un turno del catálogo (DA-37): horas de trabajo (24, 12, 8 u otras), hora de
 * entrada y qué días (todos, un día sí y uno no, N días sí y M no, o días de la semana). Si cambia el
 * horario de un turno en uso se confirma antes. El admin puede borrarlo aunque esté asignado.
 */
export function TurnoModal({
  turno,
  onClose,
  onGuardado,
}: {
  turno: TurnoCatalogo | null;
  onClose: () => void;
  onGuardado?: (t: TurnoCatalogo) => void;
}) {
  const qc = useQueryClient();
  const esAdmin = useAuthStore((s) => s.user?.rol === ROLES.ADMIN);
  const d = turno?.dias;
  const [horas, setHoras] = useState(String(turno?.horas ?? 24));
  const [hora, setHora] = useState(turno?.horaEntrada ?? '');
  const [tipoDias, setTipoDias] = useState<TipoDias>(
    !d ? 'unoYUno' : d.tipo === 'ciclo' && d.trabaja === 1 && d.descansa === 1 ? 'unoYUno' : d.tipo,
  );
  const [trabaja, setTrabaja] = useState(String(d?.tipo === 'ciclo' ? d.trabaja : 1));
  const [descansa, setDescansa] = useState(String(d?.tipo === 'ciclo' ? d.descansa : 2));
  const [semana, setSemana] = useState<number[]>(d?.tipo === 'semanal' ? d.semana : [1, 2, 3, 4, 5]);
  const [nombreManual, setNombreManual] = useState(turno?.nombre ?? '');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [confirmar, setConfirmar] = useState<'horario' | 'eliminar' | null>(null);

  const dias: DiasTurno =
    tipoDias === 'unoYUno'
      ? { tipo: 'ciclo', trabaja: 1, descansa: 1 }
      : tipoDias === 'ciclo'
        ? { tipo: 'ciclo', trabaja: Number(trabaja), descansa: Number(descansa) }
        : tipoDias === 'semanal'
          ? { tipo: 'semanal', semana }
          : { tipo: 'diario' };
  const nHoras = Number(horas);
  const nombre = nombreManual || nombreSugerido(nHoras, hora, dias);
  const horasValidas = Number.isInteger(nHoras) && nHoras >= 1 && nHoras <= 24;

  const refrescar = () => {
    void qc.invalidateQueries({ queryKey: turnosService.keys.all });
    void qc.invalidateQueries({ queryKey: sitiosService.keys.all });
  };
  const guardar = useMutation({
    mutationFn: (data: ReturnType<typeof turnoSchema.parse>) =>
      turno ? turnosService.actualizar(turno.id, data) : turnosService.crear(data),
    onSuccess: (t) => {
      refrescar();
      toast.success(turno ? 'Turno actualizado' : 'Turno creado');
      onGuardado?.(t);
      onClose();
    },
    onError: (e) => {
      setConfirmar(null);
      toast.error(mensajeDeError(e));
    },
  });
  const baja = useMutation({
    mutationFn: () => (turno!.activo ? turnosService.baja(turno!.id) : turnosService.reactivar(turno!.id)),
    onSuccess: () => {
      refrescar();
      toast.success(turno!.activo ? 'Turno dado de baja' : 'Turno reactivado');
      onClose();
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });
  const eliminar = useMutation({
    mutationFn: () => turnosService.eliminar(turno!.id),
    onSuccess: () => {
      refrescar();
      toast.success('Turno eliminado');
      onClose();
    },
    onError: (e) => {
      setConfirmar(null);
      toast.error(mensajeDeError(e));
    },
  });

  const datos = () => {
    const r = turnoSchema.safeParse({ nombre, horas, horaEntrada: hora, dias });
    if (r.success) {
      setErrores({});
      return r.data;
    }
    setErrores(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
    return null;
  };
  const cambiaHorario =
    !!turno &&
    (nHoras !== turno.horas ||
      hora !== turno.horaEntrada ||
      JSON.stringify(dias) !== JSON.stringify(turno.dias));
  const onSubmit = () => {
    const data = datos();
    if (!data) return;
    if (cambiaHorario && turno!.enUso > 0) setConfirmar('horario');
    else guardar.mutate(data);
  };

  return (
    <>
      <FormModal
        title={turno ? 'Editar turno' : 'Nuevo turno'}
        description="Horas de trabajo, hora de entrada y qué días; la salida se calcula sola"
        onClose={onClose}
        onSubmit={onSubmit}
        submitLabel="Guardar"
        loading={guardar.isPending}
        secondaryAction={
          turno && (
            <div className="flex gap-2">
              {esAdmin && (
                <Button
                  variant="danger"
                  icon={<Trash2 className="size-4" />}
                  onClick={() => setConfirmar('eliminar')}
                >
                  Eliminar
                </Button>
              )}
              {(turno.enUso === 0 || !turno.activo) && (
                <Button variant="secondary" loading={baja.isPending} onClick={() => baja.mutate()}>
                  {turno.activo ? 'Dar de baja' : 'Reactivar'}
                </Button>
              )}
            </div>
          )
        }
      >
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">Horas de trabajo</p>
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Horas de trabajo">
            {HORAS_SUGERIDAS.map((h) => (
              <button
                key={h}
                type="button"
                role="radio"
                aria-checked={horas === String(h)}
                onClick={() => setHoras(String(h))}
                className={boton(horas === String(h))}
              >
                {h} h
              </button>
            ))}
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={24}
              aria-label="Otra cantidad de horas"
              placeholder="Otra"
              value={HORAS_SUGERIDAS.some((h) => String(h) === horas) ? '' : horas}
              onChange={(e) => setHoras(e.target.value)}
              invalid={!horasValidas}
            />
          </div>
          {(errores.horas || !horasValidas) && (
            <p className="mt-1 text-sm text-red-600">{errores.horas ?? 'De 1 a 24 horas'}</p>
          )}
        </div>

        <FormField label="Hora de entrada" required error={errores.horaEntrada}>
          <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </FormField>

        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-700">Días que trabaja</p>
          {(
            [
              ['diario', 'Todos los días'],
              ['unoYUno', 'Un día sí, uno no'],
              ['ciclo', 'Trabaja unos días y descansa otros'],
              ['semanal', 'Días de la semana'],
            ] as const
          ).map(([t, label]) => (
            <label key={t} className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-1.5">
              <input
                type="radio"
                name="dias"
                className="size-4 accent-brand-700"
                checked={tipoDias === t}
                onChange={() => setTipoDias(t)}
              />
              <span className="text-sm text-slate-800">{label}</span>
            </label>
          ))}
          {tipoDias === 'ciclo' && (
            <div className="flex flex-wrap items-center gap-2 pl-8 text-sm text-slate-700">
              Trabaja
              <span className="w-16">
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={trabaja}
                  onChange={(e) => setTrabaja(e.target.value)}
                  className="h-10 text-center"
                  aria-label="Días que trabaja"
                />
              </span>
              día(s) y descansa
              <span className="w-16">
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={descansa}
                  onChange={(e) => setDescansa(e.target.value)}
                  className="h-10 text-center"
                  aria-label="Días que descansa"
                />
              </span>
              día(s)
            </div>
          )}
          {tipoDias === 'semanal' && (
            <div className="flex flex-wrap gap-1.5 pl-8" role="group" aria-label="Días de la semana">
              {SEMANA.map(([dia, letra]) => {
                const activo = semana.includes(dia);
                return (
                  <button
                    key={dia}
                    type="button"
                    aria-pressed={activo}
                    aria-label={NOMBRE_DIA[dia]}
                    onClick={() => setSemana(activo ? semana.filter((x) => x !== dia) : [...semana, dia])}
                    className={cn(
                      'size-10 rounded-full text-sm font-semibold',
                      activo ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {letra}
                  </button>
                );
              })}
            </div>
          )}
          {errores.dias && <p className="text-sm text-red-600">{errores.dias}</p>}
        </div>

        {hora && horasValidas && (
          <div className="space-y-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            <p className="flex items-center gap-1.5">
              <Clock className="size-4 shrink-0" /> {textoHorario(nHoras, hora)}
            </p>
            <p className="flex items-center gap-1.5">
              <CalendarDays className="size-4 shrink-0" /> {textoDias(dias)}
            </p>
          </div>
        )}

        <FormField label="Nombre" required error={errores.nombre} hint="Así aparece en la lista de turnos">
          <Input
            value={nombre}
            onChange={(e) => setNombreManual(e.target.value)}
            placeholder="Ej. 24 h · 8:00 a.m."
          />
        </FormField>
      </FormModal>

      <ConfirmDialog
        open={confirmar === 'horario'}
        title="¿Cambiar el horario?"
        description={`"${turno?.nombre}" pasará a: ${textoHorario(nHoras, hora)} · ${textoDias(dias).toLowerCase()}. Afecta de ahora en adelante a ${
          turno?.enUso === 1 ? '1 asignación' : `${turno?.enUso} asignaciones`
        }; se avisará a los guardias. Las marcas pasadas no cambian.`}
        confirmLabel="Cambiar"
        loading={guardar.isPending}
        onConfirm={() => {
          const data = datos();
          if (data) guardar.mutate(data);
        }}
        onCancel={() => setConfirmar(null)}
      />
      <ConfirmDialog
        open={confirmar === 'eliminar'}
        title={`¿Eliminar "${turno?.nombre}"?`}
        description={
          turno?.enUso
            ? `Está asignado ${turno.enUso === 1 ? 'una vez' : `${turno.enUso} veces`}. Los guardias seguirán con su horario actual hasta que les asignes otro (no se les avisa). Esto no se puede deshacer.`
            : 'Nadie lo usa. Esto no se puede deshacer.'
        }
        confirmLabel="Eliminar"
        variant="danger"
        loading={eliminar.isPending}
        onConfirm={() => eliminar.mutate()}
        onCancel={() => setConfirmar(null)}
      />
    </>
  );
}
