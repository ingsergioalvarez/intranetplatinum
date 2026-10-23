import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Moon, TriangleAlert } from 'lucide-react';
import {
  DESCANSO_MIN_HORAS,
  coberturaCreateSchema,
  horaLegible,
  type CandidatoCobertura,
} from '@platinum/shared';
import { mensajeDeError } from '../../core/api';
import { hoyLocal } from '../../core/format/fechas';
import {
  Badge,
  ConfirmDialog,
  EmptyState,
  FormField,
  FormModal,
  Input,
  Spinner,
  Textarea,
  cn,
  toast,
} from '../../components/ui';
import { Avatar } from './AsignarTurnoModal';
import { coberturasService } from './coberturas.service';

/**
 * Enviar a un guardia a cubrir un sitio (DA-39, DA-46): fecha (o varios días), horario, motivo
 * obligatorio y a quién. Primero salen quienes descansan; quienes trabajan a esa hora quedan con su
 * sitio en pausa. Si descansaría menos de 12 h se pide confirmar y queda registrado.
 */
export function EnviarCubrirModal({
  sitio,
  fecha,
  horaInicio = '',
  horas = 12,
  cubreA = null,
  onClose,
}: {
  sitio: { id: number; nombre: string };
  fecha?: string;
  horaInicio?: string;
  horas?: number | null;
  /** Guardia al que se cubre (si es por su falta). */
  cubreA?: { id: number; nombre: string } | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [desde, setDesde] = useState(fecha ?? hoyLocal());
  const [hasta, setHasta] = useState('');
  const [hora, setHora] = useState(horaInicio);
  const [nHoras, setNHoras] = useState(String(horas ?? 12));
  const [motivo, setMotivo] = useState(cubreA ? `Cubrir a ${cubreA.nombre}` : '');
  const [elegido, setElegido] = useState<CandidatoCobertura | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [confirmar, setConfirmar] = useState(false);

  const horasValidas = /^\d+$/.test(nHoras) && Number(nHoras) >= 1 && Number(nHoras) <= 24;
  const consulta = {
    sitioId: sitio.id,
    desde,
    ...(hasta && hasta !== desde ? { hasta } : {}),
    horaInicio: hora,
    horas: Number(nHoras),
  };
  const candidatos = useQuery({
    queryKey: coberturasService.keys.candidatos(consulta),
    queryFn: () => coberturasService.candidatos(consulta),
    enabled: !!desde && /^\d{2}:\d{2}$/.test(hora) && horasValidas,
    placeholderData: keepPreviousData,
  });
  const lista = (candidatos.data ?? []).filter((c) => c.guardia.id !== cubreA?.id);

  const enviar = useMutation({
    mutationFn: () =>
      coberturasService.crear({
        usuarioId: elegido!.guardia.id,
        sitioId: sitio.id,
        desde,
        ...(hasta && hasta !== desde ? { hasta } : {}),
        horaInicio: hora,
        horas: Number(nHoras),
        motivo: motivo.trim(),
        ...(cubreA ? { cubreAId: cubreA.id } : {}),
      }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: coberturasService.keys.all });
      void qc.invalidateQueries({ queryKey: ['asistencia'] });
      toast.success(`${r.cobertura.guardia.nombre} cubrirá ${sitio.nombre}`);
      if (r.advertencia) toast.warning(`${r.advertencia}; quedó registrado`);
      onClose();
    },
    onError: (e) => {
      setConfirmar(false);
      toast.error(mensajeDeError(e));
    },
  });

  const onSubmit = () => {
    const r = coberturaCreateSchema.safeParse({
      usuarioId: elegido?.guardia.id,
      sitioId: sitio.id,
      desde,
      ...(hasta ? { hasta } : {}),
      horaInicio: hora,
      horas: nHoras,
      motivo,
    });
    if (!r.success) {
      setErrores(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrores({});
    const poco = elegido!.descansoHoras !== null && elegido!.descansoHoras < DESCANSO_MIN_HORAS;
    if (poco) setConfirmar(true);
    else enviar.mutate();
  };

  return (
    <>
      <FormModal
        title={`Enviar a cubrir ${sitio.nombre}`}
        description={
          cubreA ? `En lugar de ${cubreA.nombre}` : 'Un turno o unos días; su sitio queda en pausa'
        }
        onClose={onClose}
        onSubmit={onSubmit}
        submitLabel="Enviar a cubrir"
        loading={enviar.isPending}
        dirty
        size="lg"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Día" required error={errores.desde}>
            <Input type="date" value={desde} min={hoyLocal()} onChange={(e) => setDesde(e.target.value)} />
          </FormField>
          <FormField label="Hasta (si son varios días)" error={errores.hasta}>
            <Input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} />
          </FormField>
          <FormField label="Hora de entrada" required error={errores.horaInicio}>
            <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </FormField>
          <FormField label="Horas del turno" required error={errores.horas}>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={24}
              value={nHoras}
              onChange={(e) => setNHoras(e.target.value)}
            />
          </FormField>
        </div>
        <FormField label="Motivo" required error={errores.motivo}>
          <Textarea
            rows={2}
            maxLength={255}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej. Falta de Ana; incapacidad; evento en el sitio"
          />
        </FormField>

        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">
            ¿Quién cubre? <span className="text-red-600">*</span>
          </p>
          {errores.usuarioId && <p className="mb-1 text-sm text-red-600">Elige al guardia</p>}
          {!hora || !horasValidas ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
              Indica la hora y las horas para ver quién está libre.
            </p>
          ) : candidatos.isPending ? (
            <div className="flex justify-center py-6 text-brand-600">
              <Spinner className="size-6" />
            </div>
          ) : lista.length === 0 ? (
            <EmptyState title="Sin guardias disponibles" />
          ) : (
            <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1" role="radiogroup" aria-label="Guardia">
              {lista.map((c) => {
                const activo = elegido?.guardia.id === c.guardia.id;
                const deshabilitado = c.estado === 'cubre';
                const poco = c.descansoHoras !== null && c.descansoHoras < DESCANSO_MIN_HORAS;
                return (
                  <li key={c.guardia.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={activo}
                      disabled={deshabilitado}
                      onClick={() => setElegido(c)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ring-1 ring-inset',
                        activo ? 'bg-brand-50 ring-2 ring-brand-600' : 'ring-slate-200 hover:bg-slate-50',
                        deshabilitado && 'cursor-not-allowed opacity-50',
                      )}
                    >
                      <Avatar foto={c.guardia.foto} nombre={c.guardia.nombre} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-slate-900">{c.guardia.nombre}</span>
                        <span className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                          {c.estado === 'descansa' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                              <Moon className="size-3.5" /> Descansa
                            </span>
                          ) : c.estado === 'trabaja' ? (
                            <span className="text-amber-700">{c.detalle}: su sitio queda en pausa</span>
                          ) : (
                            <span>{c.detalle}</span>
                          )}
                          {c.descansoHoras !== null && (
                            <span className={cn(poco && 'font-medium text-red-700')}>
                              {poco && <TriangleAlert className="mr-0.5 inline size-3.5" />}
                              Descansaría {c.descansoHoras} h
                            </span>
                          )}
                        </span>
                      </span>
                      {activo && <Badge tone="brand">Elegido</Badge>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {hora && horasValidas && (
          <p className="text-xs text-slate-500">
            Entra a las {horaLegible(hora)} por {nHoras} h. Se le avisa al guardia y checará en {sitio.nombre}
            .
          </p>
        )}
      </FormModal>

      <ConfirmDialog
        open={confirmar}
        title="Descansaría poco"
        description={`${elegido?.guardia.nombre} descansaría solo ${elegido?.descansoHoras} h (menos de ${DESCANSO_MIN_HORAS}). ¿Enviarlo de todos modos? Quedará registrado.`}
        confirmLabel="Enviar de todos modos"
        variant="danger"
        loading={enviar.isPending}
        onConfirm={() => enviar.mutate()}
        onCancel={() => setConfirmar(false)}
      />
    </>
  );
}
