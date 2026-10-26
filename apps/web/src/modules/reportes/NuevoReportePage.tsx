import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ChevronLeft, ChevronRight, MapPin, Send } from 'lucide-react';
import {
  MAX_FOTOS_REPORTE,
  PRIORIDAD_REPORTE,
  PRIORIDAD_REPORTE_DESCRIPCION,
  PRIORIDAD_REPORTE_LABEL,
  reporteCreateSchema,
  type CategoriaNodo,
  type PrioridadReporte,
  type ReporteDetalle,
} from '@platinum/shared';
import { ApiError, mensajeDeError } from '../../core/api';
import { formatFechaHora } from '../../core/format/fechas';
import { erroresDeCampos } from '../../core/forms/fieldErrors';
import {
  Button,
  Card,
  Checkbox,
  EmptyState,
  FormField,
  Input,
  PhotoUploader,
  Spinner,
  Textarea,
  cn,
  toast,
} from '../../components/ui';
import { nombreCategoria } from './categoriaIconos';
import { IconoCategoria, PrioridadBadge } from './etiquetas';
import { categoriasService, reportesService } from './reportes.service';

const PASOS = ['Sitio', 'Categoría', 'Prioridad', 'Fotos', 'Detalle'] as const;

/** Paso al que corresponde cada campo, para llevar al guardia al error. */
const PASO_DE_CAMPO: Record<string, number> = { sitioId: 0, categoriaId: 1, prioridad: 2, fotos: 3 };

const COLOR_PRIORIDAD: Record<PrioridadReporte, string> = {
  baja: 'border-slate-300 data-[sel=true]:bg-slate-100',
  media: 'border-sky-300 data-[sel=true]:bg-sky-50',
  alta: 'border-amber-400 data-[sel=true]:bg-amber-50',
  critica: 'border-red-400 data-[sel=true]:bg-red-50',
};

function Opcion({
  seleccionada,
  onClick,
  children,
  className,
}: {
  seleccionada: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-sel={seleccionada}
      aria-pressed={seleccionada}
      className={cn(
        'w-full rounded-xl border-2 p-4 text-left transition-colors active:scale-[0.99]',
        seleccionada ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Wizard móvil para crear un reporte con evidencia fotográfica (F3-04). */
export function NuevoReportePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [paso, setPaso] = useState(0);
  const [sitioId, setSitioId] = useState<number | null>(null);
  const [principal, setPrincipal] = useState<CategoriaNodo | null>(null);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [prioridad, setPrioridad] = useState<PrioridadReporte | null>(null);
  const [fotos, setFotos] = useState<File[]>([]);
  const [texto, setTexto] = useState({ titulo: '', descripcion: '', ubicacionDetalle: '' });
  const [usarGps, setUsarGps] = useState(true);
  const [errores, setErrores] = useState<Record<string, string | undefined>>({});
  const [creado, setCreado] = useState<ReporteDetalle | null>(null);

  const [searchParams] = useSearchParams();
  const paramSitioId = searchParams.get('sitioId') ? Number(searchParams.get('sitioId')) : null;

  const sitios = useQuery({ queryKey: reportesService.keys.sitios, queryFn: reportesService.sitios });
  const categorias = useQuery({
    queryKey: categoriasService.keys.arbol(false),
    queryFn: () => categoriasService.arbol(false),
  });

  // Con un solo sitio asignado o si viene por parámetro en la URL, se elige solo y se empieza en la categoría.
  useEffect(() => {
    if (sitios.data && sitioId === null) {
      if (paramSitioId && sitios.data.some((s) => s.id === paramSitioId)) {
        setSitioId(paramSitioId);
        setPaso(1);
      } else if (sitios.data.length === 1) {
        setSitioId(sitios.data[0].id);
        setPaso(1);
      }
    }
  }, [sitios.data, sitioId, paramSitioId]);

  const enviar = useMutation({
    mutationFn: async () => {
      const coords = usarGps ? await ubicacionActual() : null;
      return reportesService.crear(
        {
          sitioId: sitioId!,
          categoriaId: categoriaId!,
          prioridad: prioridad!,
          ...texto,
          lat: coords?.lat,
          lng: coords?.lng,
        },
        fotos,
      );
    },
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: reportesService.keys.all });
      void qc.invalidateQueries({ queryKey: ['avisos'] });
      setCreado(r);
    },
    onError: (e) => {
      const campos = e instanceof ApiError ? e.fieldErrors : {};
      if (Object.keys(campos).length) {
        setErrores(campos);
        setPaso(Math.min(...Object.keys(campos).map((c) => PASO_DE_CAMPO[c] ?? 4)));
      } else toast.error(mensajeDeError(e));
    },
  });

  const onEnviar = () => {
    const parsed = reporteCreateSchema.safeParse({ sitioId, categoriaId, prioridad, ...texto });
    if (!parsed.success) return setErrores(erroresDeCampos(parsed.error));
    enviar.mutate();
  };

  const cambiarTexto = (campo: keyof typeof texto, valor: string) => {
    setTexto((t) => ({ ...t, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
  };

  const reiniciar = () => {
    setCreado(null);
    setPaso(0);
    setSitioId(null);
    setPrincipal(null);
    setCategoriaId(null);
    setPrioridad(null);
    setFotos([]);
    setTexto({ titulo: '', descripcion: '', ubicacionDetalle: '' });
    setErrores({});
  };

  const puedeAvanzar = [sitioId !== null, categoriaId !== null, prioridad !== null, fotos.length > 0, true][
    paso
  ];
  const sitio = sitios.data?.find((s) => s.id === sitioId);

  if (creado) {
    const primeraFoto = creado.evidencias[0];
    return (
      <Card className="mx-auto max-w-lg overflow-hidden">
        <div className="border-b border-emerald-100 bg-emerald-50/80 px-6 py-6 text-center">
          <div className="mx-auto mb-2.5 flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="size-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Reporte registrado</h1>
          <p className="mt-0.5 text-xs text-slate-600">Guardado formalmente en la intranet</p>
        </div>

        <div className="space-y-4 p-5">
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Folio oficial
                </span>
                <p className="font-mono text-base font-bold text-slate-900">{creado.folio}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Fecha y hora
                </span>
                <p className="text-xs font-medium text-slate-700">{formatFechaHora(creado.createdAt)}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {primeraFoto && (
                <div className="size-16 shrink-0 overflow-hidden rounded-lg border border-slate-300 bg-slate-200">
                  <img src={primeraFoto.url} alt="" className="size-full object-cover" />
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <PrioridadBadge prioridad={creado.prioridad} />
                  <span className="text-xs text-slate-500">· {nombreCategoria(creado.categoria)}</span>
                </div>
                <p className="truncate text-sm font-semibold text-slate-900">{creado.titulo}</p>
                <p className="truncate text-xs text-slate-600">
                  {creado.sitio.nombre} · {creado.cliente.nombreComercial}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-sky-200/80 bg-sky-50/80 p-3 text-xs text-sky-800">
            <span className="text-base leading-none">ℹ️</span>
            <p>
              Tu supervisor ya recibió el aviso en su campanita y dará seguimiento oficial por este medio.
            </p>
          </div>

          <div className="space-y-2 pt-1">
            <Button size="lg" fullWidth onClick={() => navigate(`/reportes/${creado.id}`, { replace: true })}>
              Ver reporte y seguimiento
            </Button>
            <Button size="lg" variant="secondary" fullWidth onClick={reiniciar}>
              Hacer otro reporte
            </Button>
            <div className="pt-1 text-center">
              <Link to="/" className="text-xs font-medium text-slate-500 hover:text-slate-800">
                Volver al inicio
              </Link>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (sitios.isPending || categorias.isPending) {
    return (
      <div className="flex justify-center py-16 text-brand-600">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (sitios.data && sitios.data.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<MapPin className="size-10" />}
          title="No tienes sitios asignados"
          description="Tu supervisor debe asignarte a un sitio para que puedas generar reportes."
          action={
            <Link to="/" className="text-sm font-medium text-brand-700">
              Volver al inicio
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Encabezado y avance */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">Nuevo reporte</h1>
          <span className="text-sm text-slate-500">
            Paso {paso + 1} de {PASOS.length}
          </span>
        </div>
        <div className="mt-2 flex gap-1" aria-hidden="true">
          {PASOS.map((p, i) => (
            <div
              key={p}
              className={cn('h-1.5 flex-1 rounded-full', i <= paso ? 'bg-brand-600' : 'bg-slate-200')}
            />
          ))}
        </div>
        <p className="mt-2 text-sm font-medium text-brand-700">{PASOS[paso]}</p>
      </div>

      <div className="space-y-3">
        {paso === 0 && (
          <>
            <p className="text-sm text-slate-600">¿Dónde está el problema?</p>
            {sitios.data?.map((s) => (
              <Opcion
                key={s.id}
                seleccionada={s.id === sitioId}
                onClick={() => {
                  setSitioId(s.id);
                  setErrores({});
                  setPaso(1);
                }}
              >
                <p className="font-semibold text-slate-900">{s.nombre}</p>
                <p className="text-sm text-slate-500">{s.cliente.nombreComercial}</p>
                {s.direccion && <p className="mt-0.5 text-sm text-slate-500">{s.direccion}</p>}
              </Opcion>
            ))}
            {errores.sitioId && <p className="text-sm text-red-600">{errores.sitioId}</p>}
          </>
        )}

        {paso === 1 &&
          (principal === null || principal.hijas.length === 0 ? (
            <>
              <p className="text-sm text-slate-600">¿Qué tipo de problema es?</p>
              <div className="grid grid-cols-2 gap-3">
                {categorias.data?.map((c) => (
                  <Opcion
                    key={c.id}
                    seleccionada={principal?.id === c.id}
                    className="flex flex-col items-center gap-2 py-5 text-center"
                    onClick={() => {
                      setPrincipal(c);
                      setErrores({});
                      if (c.hijas.length === 0) {
                        setCategoriaId(c.id);
                        setPaso(2);
                      } else setCategoriaId(null);
                    }}
                  >
                    <IconoCategoria icono={c.icono} className="size-8 text-brand-700" />
                    <span className="text-sm font-medium text-slate-900">{c.nombre}</span>
                  </Opcion>
                ))}
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setPrincipal(null)}
                className="flex items-center gap-1 text-sm font-medium text-slate-500"
              >
                <ChevronLeft className="size-4" /> Otras categorías
              </button>
              <p className="flex items-center gap-2 font-semibold text-slate-900">
                <IconoCategoria icono={principal.icono} className="size-5 text-brand-700" />
                {principal.nombre}
              </p>
              {[
                ...principal.hijas,
                { ...principal, nombre: `Otro problema de ${principal.nombre.toLowerCase()}` },
              ].map((h) => (
                <Opcion
                  key={h.id}
                  seleccionada={categoriaId === h.id}
                  onClick={() => {
                    setCategoriaId(h.id);
                    setPaso(2);
                  }}
                >
                  <span className="font-medium text-slate-900">{h.nombre}</span>
                </Opcion>
              ))}
            </>
          ))}
        {paso === 1 && errores.categoriaId && <p className="text-sm text-red-600">{errores.categoriaId}</p>}

        {paso === 2 && (
          <>
            <p className="text-sm text-slate-600">¿Qué tan urgente es?</p>
            {PRIORIDAD_REPORTE.map((p) => (
              <Opcion
                key={p}
                seleccionada={prioridad === p}
                className={prioridad === p ? COLOR_PRIORIDAD[p] : undefined}
                onClick={() => {
                  setPrioridad(p);
                  setPaso(3);
                }}
              >
                <p className="font-semibold text-slate-900">{PRIORIDAD_REPORTE_LABEL[p]}</p>
                <p className="text-sm text-slate-500">{PRIORIDAD_REPORTE_DESCRIPCION[p]}</p>
              </Opcion>
            ))}
          </>
        )}

        {paso === 3 && (
          <>
            <p className="text-sm text-slate-600">
              Toma fotos claras del problema. Al menos una es obligatoria.
            </p>
            <PhotoUploader
              value={fotos}
              onChange={(f) => {
                setFotos(f);
                setErrores((e) => ({ ...e, fotos: undefined }));
              }}
              max={MAX_FOTOS_REPORTE}
              error={errores.fotos}
            />
          </>
        )}

        {paso === 4 && (
          <Card className="space-y-4 p-4">
            <FormField
              label="Título"
              required
              error={errores.titulo}
              hint="Ej. Lámpara fundida en el acceso principal"
            >
              <Input
                value={texto.titulo}
                maxLength={150}
                onChange={(e) => cambiarTexto('titulo', e.target.value)}
              />
            </FormField>
            <FormField label="¿Qué pasa?" required error={errores.descripcion}>
              <Textarea
                value={texto.descripcion}
                rows={4}
                maxLength={2000}
                placeholder="Describe lo que ves, desde cuándo y si hay riesgo."
                onChange={(e) => cambiarTexto('descripcion', e.target.value)}
              />
            </FormField>
            <FormField
              label="Ubicación exacta"
              error={errores.ubicacionDetalle}
              hint="Piso, pasillo, número de cámara…"
            >
              <Input
                value={texto.ubicacionDetalle}
                maxLength={200}
                onChange={(e) => cambiarTexto('ubicacionDetalle', e.target.value)}
              />
            </FormField>
            <Checkbox
              checked={usarGps}
              onChange={(e) => setUsarGps(e.target.checked)}
              label="Adjuntar mi ubicación GPS"
              description="Ayuda a ubicar el problema en el mapa."
            />
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              <p>
                <span className="font-medium text-slate-800">{sitio?.nombre}</span> ·{' '}
                {sitio?.cliente.nombreComercial}
              </p>
              <p>
                {prioridad && PRIORIDAD_REPORTE_LABEL[prioridad]} · {fotos.length}{' '}
                {fotos.length === 1 ? 'foto' : 'fotos'}
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Acciones: fijas sobre la navegación inferior en celular */}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] mt-6 flex gap-2 bg-slate-50/95 py-2 backdrop-blur md:bottom-0">
        {paso > 0 && (
          <Button
            variant="secondary"
            size="lg"
            icon={<ChevronLeft className="size-4" />}
            onClick={() => setPaso((p) => p - 1)}
            disabled={enviar.isPending}
          >
            Atrás
          </Button>
        )}
        {paso < PASOS.length - 1 ? (
          <Button size="lg" className="flex-1" disabled={!puedeAvanzar} onClick={() => setPaso((p) => p + 1)}>
            Continuar <ChevronRight className="size-4" />
          </Button>
        ) : (
          <Button
            size="lg"
            className="flex-1"
            icon={<Send className="size-4" />}
            loading={enviar.isPending}
            onClick={onEnviar}
          >
            {enviar.isPending ? 'Enviando…' : 'Enviar reporte'}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Ubicación del dispositivo; si no se obtiene en 10 s se envía sin ella. */
function ubicacionActual(): Promise<{ lat: number; lng: number } | null> {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((ok) =>
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        ok({ lat: Number(coords.latitude.toFixed(7)), lng: Number(coords.longitude.toFixed(7)) }),
      () => ok(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    ),
  );
}
