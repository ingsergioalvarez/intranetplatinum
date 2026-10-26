import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, FileText } from 'lucide-react';
import {
  DIAS_MAX_INFORME,
  TIPOS_INFORME,
  TIPO_INFORME_LABEL,
  atajosPeriodo,
  diasEntre,
  nuevoInformeSchema,
  type TipoInforme,
} from '@platinum/shared';
import { Button, Checkbox, FormField, Input, Modal, Select, cn, toast } from '../../components/ui';
import { ApiError, mensajeDeError } from '../../core/api';
import { hoyLocal } from '../../core/format/fechas';
import { informesService, type FormatoInforme } from './informes.service';

const ATAJOS = [
  ['quincena1', 'Quincena 1-15'],
  ['quincena2', 'Quincena 16-fin'],
  ['mes', 'Mes'],
  ['mesAnterior', 'Mes anterior'],
] as const;

/**
 * Nuevo reporte de asistencia (DA-52): se elige el tipo, el guardia o sitio y el periodo, y se
 * genera el PDF oficial (o el Excel de trabajo). Emitirlo lo congela con folio; si ya existía uno
 * idéntico se descarga ese en lugar de abrir otro folio.
 */
export function NuevoInformeModal({
  guardia,
  onClose,
}: {
  /** Desde la ficha del guardia: el reporte es de él y no se cambia. */
  guardia?: { id: number; nombre: string };
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const hoy = hoyLocal();
  const atajos = atajosPeriodo(hoy);
  const [tipo, setTipo] = useState<TipoInforme>('personal');
  const [guardiaId, setGuardiaId] = useState(guardia ? String(guardia.id) : '');
  const [sitioId, setSitioId] = useState('');
  const [[desde, hasta], setPeriodo] = useState<[string, string]>(atajos.quincena1[0] > hoy ? atajos.mesAnterior : atajos.mes);
  const [incluirFirmas, setIncluirFirmas] = useState(true);
  const [incluirDetalle, setIncluirDetalle] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});

  const opciones = useQuery({
    queryKey: informesService.keys.opciones,
    queryFn: informesService.opciones,
    enabled: !guardia,
  });

  const generar = useMutation({
    mutationFn: async ({ formato, ventana }: { formato: FormatoInforme; ventana: Window | null }) => {
      const datos = nuevoInformeSchema.parse({
        tipo: guardia ? 'personal' : tipo,
        guardiaId: tipo === 'personal' || guardia ? Number(guardiaId) : null,
        sitioId: tipo === 'general' && sitioId ? Number(sitioId) : null,
        desde,
        hasta,
        incluirFirmas,
        incluirDetalle: tipo === 'general' && incluirDetalle,
      });
      const { informe, existente } = await informesService.emitir(datos);
      await informesService.descargar(informe, formato, ventana);
      return { informe, existente };
    },
    onSuccess: ({ informe, existente }) => {
      void qc.invalidateQueries({ queryKey: informesService.keys.all });
      toast.success(
        existente
          ? `Ya existía el reporte ${informe.folio} con los mismos datos; se descargó ese`
          : `Reporte ${informe.folio} emitido`,
      );
      onClose();
    },
    onError: (e, { ventana }) => {
      ventana?.close();
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) {
        setErrores(e.fieldErrors as Record<string, string>);
      } else {
        toast.error(mensajeDeError(e));
      }
    },
  });

  const enviar = (formato: FormatoInforme) => {
    const r = nuevoInformeSchema.safeParse({
      tipo: guardia ? 'personal' : tipo,
      guardiaId: tipo === 'personal' || guardia ? Number(guardiaId) || null : null,
      sitioId: tipo === 'general' && sitioId ? Number(sitioId) : null,
      desde,
      hasta,
    });
    if (!r.success) {
      setErrores(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrores({});
    // El PDF se abre en una pestaña (vista previa): se abre ya, con el toque, para que no la bloqueen.
    generar.mutate({ formato, ventana: formato === 'pdf' ? window.open('', '_blank') : null });
  };

  const dias = desde && hasta && hasta >= desde ? diasEntre(desde, hasta) : null;

  return (
    <Modal
      open
      onClose={onClose}
      title="Nuevo reporte de asistencia"
      description={guardia ? guardia.nombre : 'Documento oficial con folio; ya no se edita después de emitirlo.'}
      dismissible={!generar.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={generar.isPending}>
            Cancelar
          </Button>
          <Button
            variant="secondary"
            icon={<FileSpreadsheet className="size-4" />}
            onClick={() => enviar('excel')}
            loading={generar.isPending && generar.variables?.formato === 'excel'}
            disabled={generar.isPending}
          >
            Generar Excel
          </Button>
          <Button
            icon={<FileText className="size-4" />}
            onClick={() => enviar('pdf')}
            loading={generar.isPending && generar.variables?.formato === 'pdf'}
            disabled={generar.isPending}
          >
            Generar PDF oficial
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!guardia && (
          <div role="tablist" aria-label="Tipo de reporte" className="flex gap-1 rounded-xl bg-slate-200/60 p-1">
            {TIPOS_INFORME.map((t) => (
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
                {TIPO_INFORME_LABEL[t]}
              </button>
            ))}
          </div>
        )}

        {!guardia && tipo === 'personal' && (
          <FormField label="Guardia" required error={errores.guardiaId}>
            <Select
              value={guardiaId}
              onChange={(e) => setGuardiaId(e.target.value)}
              placeholder={opciones.isPending ? 'Cargando…' : 'Elige un guardia'}
              options={(opciones.data?.guardias ?? []).map((g) => ({ value: g.id, label: g.nombre }))}
            />
          </FormField>
        )}
        {tipo === 'general' && !guardia && (
          <FormField label="Sitio" hint="Vacío: todos los sitios que puedes ver." error={errores.sitioId}>
            <Select
              value={sitioId}
              onChange={(e) => setSitioId(e.target.value)}
              placeholder="Todos los sitios"
              options={(opciones.data?.sitios ?? []).map((s) => ({ value: s.id, label: s.nombre }))}
            />
          </FormField>
        )}

        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">Periodo</p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {ATAJOS.map(([clave, etiqueta]) => {
              const [d, h] = atajos[clave];
              const activo = d === desde && h === hasta;
              return (
                <button
                  key={clave}
                  type="button"
                  onClick={() => setPeriodo([d, h])}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-sm ring-1 ring-inset transition-colors',
                    activo
                      ? 'bg-brand-700 text-white ring-brand-700'
                      : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50',
                  )}
                >
                  {etiqueta}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Desde" required error={errores.desde}>
              <Input type="date" value={desde} max={hoy} onChange={(e) => setPeriodo([e.target.value, hasta])} />
            </FormField>
            <FormField label="Hasta" required error={errores.hasta}>
              <Input type="date" value={hasta} onChange={(e) => setPeriodo([desde, e.target.value])} />
            </FormField>
          </div>
          <p className={cn('mt-1 text-xs', dias && dias > DIAS_MAX_INFORME ? 'text-red-600' : 'text-slate-500')}>
            {dias ? `${dias} ${dias === 1 ? 'día' : 'días'}` : 'Elige las fechas'} · máximo {DIAS_MAX_INFORME} días
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 px-3 py-1 ring-1 ring-slate-200 ring-inset">
          <Checkbox
            label="Incluir líneas de firma"
            description="Guardia, supervisor y administración."
            checked={incluirFirmas}
            onChange={(e) => setIncluirFirmas(e.target.checked)}
          />
          {tipo === 'general' && !guardia && (
            <Checkbox
              label="Incluir el detalle de cada guardia"
              description="Anexa sus hojas personales al final (el PDF queda más largo)."
              checked={incluirDetalle}
              onChange={(e) => setIncluirDetalle(e.target.checked)}
            />
          )}
        </div>
        <p className="text-xs text-slate-500">
          El PDF es el documento oficial. El Excel es una copia de trabajo, marcada como no oficial.
        </p>
      </div>
    </Modal>
  );
}
