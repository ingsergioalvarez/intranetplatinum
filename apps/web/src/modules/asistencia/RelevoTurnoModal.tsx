import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  KeyRound,
  PhoneCall,
  ShieldCheck,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';
import { Button, FormField, Modal, PhotoUploader, Textarea, cn, toast } from '../../components/ui';
import { useAuthStore } from '../../core/auth/authStore';
import { categoriasService, reportesService } from '../reportes/reportes.service';

type EstadoActivo = 'ok' | 'novedad';

interface ActivoConsigna {
  id: 'celular' | 'llaves' | 'telefono';
  nombre: string;
  icon: LucideIcon;
  subtituloSalida: string;
  subtituloEntrada: string;
}

const ACTIVOS_CONSIGNA: ActivoConsigna[] = [
  {
    id: 'celular',
    nombre: 'Celular del sitio',
    icon: Smartphone,
    subtituloSalida: 'Entregado con carga y funcionando',
    subtituloEntrada: 'Recibido con carga y funcionando',
  },
  {
    id: 'llaves',
    nombre: 'Llaves del inmueble',
    icon: KeyRound,
    subtituloSalida: 'Juego de llaves completo y en orden',
    subtituloEntrada: 'Juego de llaves recibido completo',
  },
  {
    id: 'telefono',
    nombre: 'Teléfono fijo',
    icon: PhoneCall,
    subtituloSalida: 'Con línea y funcionando en caseta',
    subtituloEntrada: 'Con línea y funcionando al recibir',
  },
];

export interface RelevoTurnoModalProps {
  tipo: 'entrada' | 'salida';
  sitio: { id: number; nombre: string } | null;
  ubicacion?: { lat: number; lng: number } | null;
  onCancelar: () => void;
  onContinuar: () => void;
}

/**
 * Checklist obligatorio de entrega y recepción de consignas (REP-07 y REP-08).
 * Valida los 3 activos críticos del inmueble (Celular, Llaves y Teléfono fijo).
 * Si hay novedades, levanta automáticamente un reporte oficial con evidencias fotográficas.
 */
export function RelevoTurnoModal({ tipo, sitio, ubicacion, onCancelar, onContinuar }: RelevoTurnoModalProps) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [estados, setEstados] = useState<Record<string, EstadoActivo>>({
    celular: 'ok',
    llaves: 'ok',
    telefono: 'ok',
  });
  const [detalle, setDetalle] = useState('');
  const [fotos, setFotos] = useState<File[]>([]);
  const [errorDetalle, setErrorDetalle] = useState<string | undefined>();
  const [errorFotos, setErrorFotos] = useState<string | undefined>();

  const categorias = useQuery({
    queryKey: categoriasService.keys.arbol(false),
    queryFn: () => categoriasService.arbol(false),
  });

  const reportesRecientes = useQuery({
    queryKey: ['reportes', 'sitio-recientes', sitio?.id],
    queryFn: () => reportesService.list({ sitioId: sitio!.id, limit: 10 }),
    enabled: !!sitio && tipo === 'entrada',
  });

  const novedadesTurnoAnterior = (reportesRecientes.data?.items ?? []).filter(
    (r) =>
      r.estatus !== 'cerrado' &&
      r.creadoPor.id !== user?.id &&
      (r.titulo.toLowerCase().includes('relevo') ||
        r.titulo.toLowerCase().includes('novedad') ||
        r.categoria.nombre.toLowerCase().includes('caseta') ||
        r.categoria.nombre.toLowerCase().includes('consigna')),
  );

  const cambiarEstado = (id: string, nuevo: EstadoActivo) => {
    setEstados((prev) => ({ ...prev, [id]: nuevo }));
    setErrorDetalle(undefined);
  };

  const activosConNovedad = ACTIVOS_CONSIGNA.filter((a) => estados[a.id] === 'novedad');
  const hayNovedad = activosConNovedad.length > 0;

  // Busca categoría de consignas o la primera activa disponible
  const resolverCategoriaId = () => {
    const arbol = categorias.data ?? [];
    for (const cat of arbol) {
      const hijaConsigna = cat.hijas.find(
        (h) =>
          h.nombre.toLowerCase().includes('consigna') ||
          h.nombre.toLowerCase().includes('celular') ||
          h.nombre.toLowerCase().includes('llave') ||
          h.nombre.toLowerCase().includes('caseta'),
      );
      if (hijaConsigna) return hijaConsigna.id;
    }
    // Fallback: primer hoja del árbol
    for (const cat of arbol) {
      if (cat.hijas.length > 0) return cat.hijas[0].id;
      return cat.id;
    }
    return 1;
  };

  const enviarReporte = useMutation({
    mutationFn: async () => {
      if (!sitio) throw new Error('No se detectó el sitio para registrar el reporte');
      const nombresNovedad = activosConNovedad.map((a) => a.nombre).join(', ');
      const titulo =
        tipo === 'salida'
          ? `Relevo de salida: novedad en ${nombresNovedad}`
          : `Relevo de entrada: novedad en ${nombresNovedad}`;
      const descCompleta = `Activos con reporte de novedad:\n${activosConNovedad.map((a) => `• ${a.nombre}`).join('\n')}\n\nDetalle registrado por el guardia:\n${detalle.trim()}`;

      return reportesService.crear(
        {
          sitioId: sitio.id,
          categoriaId: resolverCategoriaId(),
          prioridad: 'alta',
          titulo,
          descripcion: descCompleta,
          ubicacionDetalle: `Relevo de ${tipo === 'salida' ? 'entrega de turno' : 'recepción de turno'}`,
          lat: ubicacion?.lat,
          lng: ubicacion?.lng,
        },
        fotos,
      );
    },
    onSuccess: (rep) => {
      void qc.invalidateQueries({ queryKey: reportesService.keys.all });
      void qc.invalidateQueries({ queryKey: ['avisos'] });
      toast.success(`Reporte oficial de relevo registrado (${rep.folio})`);
      onContinuar();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'No se pudo registrar el reporte de relevo');
    },
  });

  const handleSubmit = () => {
    if (!hayNovedad) {
      onContinuar();
      return;
    }

    let valido = true;
    if (detalle.trim().length < 10) {
      setErrorDetalle('Describe la novedad con al menos 10 caracteres');
      valido = false;
    } else {
      setErrorDetalle(undefined);
    }

    if (fotos.length === 0) {
      setErrorFotos('Agrega al menos una foto como evidencia del activo');
      valido = false;
    } else {
      setErrorFotos(undefined);
    }

    if (!valido) return;
    enviarReporte.mutate();
  };

  const esSalida = tipo === 'salida';
  const tituloModal = esSalida ? 'Entrega de Turno y Consignas' : 'Recepción de Turno y Consignas';
  const descModal = esSalida
    ? 'Verifica el estado de los 3 activos del sitio antes de checar tu salida.'
    : 'Confirma la recepción en orden de los 3 activos del turno saliente.';

  return (
    <Modal open onClose={onCancelar} title={tituloModal} description={descModal} size="md">
      <div className="space-y-4">
        {sitio && (
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">Sitio:</span> {sitio.nombre}
          </div>
        )}

        {/* Novedades reportadas en este sitio (al checar entrada) */}
        {tipo === 'entrada' && novedadesTurnoAnterior.length > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-3.5 text-amber-900 shadow-xs">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="size-5 shrink-0 text-amber-600 mt-0.5" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
                    Novedades del turno saliente ({novedadesTurnoAnterior.length})
                  </p>
                  <a
                    href="/reportes"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-amber-800 hover:text-amber-950 underline"
                  >
                    Ver todos
                  </a>
                </div>
                <div className="space-y-1.5">
                  {novedadesTurnoAnterior.map((rep) => (
                    <div
                      key={rep.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-white/95 p-2 text-xs border border-amber-200"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">
                          {rep.folio} · {rep.titulo}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Reportó: {rep.creadoPor.nombre} · {rep.estatus}
                        </p>
                      </div>
                      <a
                        href={`/reportes/${rep.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-200 transition-colors"
                      >
                        Ver <ExternalLink className="size-3" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Los 3 activos críticos del inmueble */}
        <div className="space-y-2.5">
          {ACTIVOS_CONSIGNA.map(({ id, nombre, icon: Icon, subtituloSalida, subtituloEntrada }) => {
            const estado = estados[id];
            const subtitulo = esSalida ? subtituloSalida : subtituloEntrada;
            const esNovedad = estado === 'novedad';

            return (
              <div
                key={id}
                className={cn(
                  'rounded-xl border p-3.5 transition-all',
                  esNovedad
                    ? 'border-amber-300 bg-amber-50/60 ring-1 ring-amber-300'
                    : 'border-slate-200 bg-white hover:border-slate-300',
                )}
              >
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-lg',
                        esNovedad ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700',
                      )}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">{nombre}</h4>
                      <p className="text-xs text-slate-500">{subtitulo}</p>
                    </div>
                  </div>

                  <div className="flex rounded-lg bg-slate-100 p-0.5 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => cambiarEstado(id, 'ok')}
                      className={cn(
                        'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                        !esNovedad
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900',
                      )}
                    >
                      ✓ Conforme
                    </button>
                    <button
                      type="button"
                      onClick={() => cambiarEstado(id, 'novedad')}
                      className={cn(
                        'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                        esNovedad
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900',
                      )}
                    >
                      ! Con novedad
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mensaje de confirmación cuando todo está conforme */}
        {!hayNovedad && (
          <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-800">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
            <p>
              {esSalida
                ? 'Los 3 activos se entregan conformes y funcionando. Procede a registrar tu salida.'
                : 'Confirmas recibir conformes los 3 activos del turno saliente. Procede a registrar tu entrada.'}
            </p>
          </div>
        )}

        {/* Sección de novedad y captura de evidencia obligatoria si hay anomalía */}
        {hayNovedad && (
          <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3.5">
            <div className="flex items-start gap-2 text-xs text-amber-800">
              <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
              <p>
                {esSalida
                  ? 'Se generará automáticamente un reporte oficial para notificar al supervisor antes de tu salida.'
                  : 'Se generará automáticamente un reporte de recepción para protegerte y deslindar anomalías recibidas.'}
              </p>
            </div>

            <FormField label="¿Qué daño o faltante presentan los activos?" required error={errorDetalle}>
              <Textarea
                rows={3}
                value={detalle}
                maxLength={1000}
                placeholder="Describe el estado de los activos (ej. Pantalla estrellada, equipo no enciende, falta llave de acceso)..."
                onChange={(e) => {
                  setDetalle(e.target.value);
                  setErrorDetalle(undefined);
                }}
              />
            </FormField>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Fotos de evidencia del activo <span className="text-red-500">*</span>
              </label>
              <PhotoUploader
                value={fotos}
                onChange={(f) => {
                  setFotos(f);
                  setErrorFotos(undefined);
                }}
                max={5}
                error={errorFotos}
              />
            </div>
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
          <Button variant="secondary" onClick={onCancelar} disabled={enviarReporte.isPending}>
            Cancelar
          </Button>

          {hayNovedad ? (
            <Button
              loading={enviarReporte.isPending}
              icon={<ShieldCheck className="size-4" />}
              onClick={handleSubmit}
            >
              {esSalida ? 'Registrar novedad y checar salida' : 'Registrar novedad y checar entrada'}
            </Button>
          ) : (
            <Button icon={<ChevronRight className="size-4" />} onClick={handleSubmit}>
              {esSalida ? 'Confirmar y checar salida' : 'Confirmar y checar entrada'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
