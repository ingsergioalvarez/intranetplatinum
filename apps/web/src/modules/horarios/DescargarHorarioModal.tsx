import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, Share2 } from 'lucide-react';
import { DIAS_MAX_HORARIO, atajosHorario, horarioPdfQuerySchema } from '@platinum/shared';
import { Button, Checkbox, FormField, Input, Modal, Select, cn, toast } from '../../components/ui';
import { mensajeDeError } from '../../core/api';
import { hoyLocal } from '../../core/format/fechas';
import { informesService } from '../informes/informes.service';
import { horariosService } from './horarios.service';

type Para = 'todos' | 'sitio' | 'guardias';

const ATAJOS = [
  ['estaSemana', 'Esta semana'],
  ['proximaSemana', 'Próxima semana'],
  ['esteMes', 'Este mes'],
] as const;

/**
 * Descargar el horario de guardias en PDF (A-55): un apoyo extra para supervisor y admin. Se elige el rango
 * de fechas (con atajos) y de quién: todos sus guardias, un sitio o guardias concretos. El guardia no lo
 * descarga: el horario válido es el de la app.
 */
export function DescargarHorarioModal({
  guardia,
  onClose,
}: {
  /** Desde la ficha del guardia: el horario es de él. */
  guardia?: { id: number; nombre: string };
  onClose: () => void;
}) {
  const atajos = atajosHorario(hoyLocal());
  const [para, setPara] = useState<Para>(guardia ? 'guardias' : 'todos');
  const [sitioId, setSitioId] = useState('');
  const [elegidos, setElegidos] = useState<number[]>(guardia ? [guardia.id] : []);
  const [[desde, hasta], setRango] = useState<[string, string]>(atajos.estaSemana);
  const [error, setError] = useState<string | null>(null);

  const opciones = useQuery({ queryKey: informesService.keys.opciones, queryFn: informesService.opciones, enabled: !guardia });
  const puedeCompartir =
    typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([], 'x.pdf', { type: 'application/pdf' })] });

  const consulta = () => {
    const q = {
      desde,
      hasta,
      ...(para === 'guardias' && elegidos.length ? { guardias: elegidos.join(',') } : {}),
      ...(para === 'sitio' && sitioId ? { sitioId: Number(sitioId) } : {}),
    };
    const r = horarioPdfQuerySchema.safeParse(q);
    if (!r.success) {
      setError(r.error.issues[0].message);
      return null;
    }
    if (para === 'guardias' && elegidos.length === 0) {
      setError('Elige al menos un guardia');
      return null;
    }
    if (para === 'sitio' && !sitioId) {
      setError('Elige el sitio');
      return null;
    }
    setError(null);
    return q;
  };

  const bajar = useMutation({
    mutationFn: async (compartir: boolean) => {
      const q = consulta();
      if (!q) return;
      const pdf = await horariosService.pdf(q);
      if (compartir) {
        const archivo = new File([pdf.blob], pdf.nombre, { type: 'application/pdf' });
        await navigator.share({ files: [archivo], title: 'Horario de guardias' }).catch((e: unknown) => {
          if (!(e instanceof DOMException && e.name === 'AbortError')) throw e;
        });
        return;
      }
      const url = URL.createObjectURL(pdf.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pdf.nombre;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success('Horario descargado');
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Descargar horario (PDF)"
      description={guardia ? guardia.nombre : 'Un apoyo para recordarle a tus guardias su horario'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          {puedeCompartir && (
            <Button variant="secondary" icon={<Share2 className="size-4" />} loading={bajar.isPending} onClick={() => bajar.mutate(true)}>
              Compartir
            </Button>
          )}
          <Button icon={<Download className="size-4" />} loading={bajar.isPending} onClick={() => bajar.mutate(false)}>
            Descargar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Es opcional y solo de apoyo: el PDF lleva la fecha en que se generó y dice que el horario válido es el de la
          app (puede cambiar).
        </p>

        <FormField label="Periodo" error={error && error.includes('fecha') ? error : undefined} hint={`Máximo ${DIAS_MAX_HORARIO} días.`}>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Atajos de periodo">
              {ATAJOS.map(([k, texto]) => {
                const activo = atajos[k][0] === desde && atajos[k][1] === hasta;
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => setRango(atajos[k])}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset',
                      activo ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
                    )}
                  >
                    {texto}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" aria-label="Desde" value={desde} onChange={(e) => setRango([e.target.value, hasta])} />
              <Input type="date" aria-label="Hasta" value={hasta} onChange={(e) => setRango([desde, e.target.value])} />
            </div>
          </div>
        </FormField>

        {!guardia && (
          <>
            <FormField label="¿De quién?">
              <Select
                value={para}
                onChange={(e) => setPara(e.target.value as Para)}
                options={[
                  { value: 'todos', label: 'Todos mis guardias' },
                  { value: 'sitio', label: 'Un sitio' },
                  { value: 'guardias', label: 'Guardias que elija' },
                ]}
              />
            </FormField>
            {para === 'sitio' && (
              <FormField label="Sitio" error={error === 'Elige el sitio' ? error : undefined}>
                <Select
                  value={sitioId}
                  onChange={(e) => setSitioId(e.target.value)}
                  placeholder="Elige el sitio"
                  options={(opciones.data?.sitios ?? []).map((s) => ({ value: String(s.id), label: s.nombre }))}
                />
              </FormField>
            )}
            {para === 'guardias' && (
              <FormField label="Guardias" error={error === 'Elige al menos un guardia' ? error : undefined}>
                <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg ring-1 ring-slate-200 ring-inset">
                  {(opciones.data?.guardias ?? []).map((g) => (
                    <li key={g.id} className="px-3 py-2">
                      <Checkbox
                        checked={elegidos.includes(g.id)}
                        onChange={(e) =>
                          setElegidos((prev) => (e.target.checked ? [...prev, g.id] : prev.filter((x) => x !== g.id)))
                        }
                        label={g.nombre}
                      />
                    </li>
                  ))}
                </ul>
              </FormField>
            )}
          </>
        )}
        {error && !['Elige el sitio', 'Elige al menos un guardia'].includes(error) && !error.includes('fecha') && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </div>
    </Modal>
  );
}
