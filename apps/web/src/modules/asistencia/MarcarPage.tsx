import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight,
  CircleCheck,
  Coffee,
  LogIn,
  LogOut,
  MapPin,
  MapPinOff,
  RefreshCw,
  TriangleAlert,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import {
  ALERTA_MARCACION_LABEL,
  RADIO_GEOCERCA_M,
  TIPO_MARCACION_LABEL,
  distanciaMetros,
  sitioMasCercano,
  type EstadoAsistencia,
  type Marcacion,
  type TipoMarcacion,
} from '@platinum/shared';
import { PageHeader } from '../../components/layout/AppShell';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Modal,
  Spinner,
  cn,
  toast,
} from '../../components/ui';
import { asistenciaService } from './asistencia.service';
import { formatDiaLargo, formatHora } from './formato';
import { SinUbicacionError, nuevoIdMarca, obtenerUbicacion, type Ubicacion } from './ubicacion';

const BOTONES: { tipo: TipoMarcacion; icon: LucideIcon }[] = [
  { tipo: 'entrada', icon: LogIn },
  { tipo: 'inicio_comida', icon: Coffee },
  { tipo: 'fin_comida', icon: Utensils },
  { tipo: 'salida', icon: LogOut },
];

const CONFIRMAR: Record<TipoMarcacion, string> = {
  entrada: '¿Registrar tu entrada?',
  inicio_comida: '¿Iniciar tu comida?',
  fin_comida: '¿Terminar tu comida?',
  salida: '¿Registrar tu salida?',
};

type EstadoUbicacion =
  | { estado: 'buscando' }
  | { estado: 'ok'; ubicacion: Ubicacion }
  | { estado: 'error'; error: SinUbicacionError };

/** Sitio contra el que se mide: el de la jornada abierta o, si toca entrada, el asignado más cercano. */
function sitioDeReferencia(data: EstadoAsistencia, ubicacion: Ubicacion | null) {
  const abierta = data.jornada && !data.permitidas.includes('entrada') ? data.jornada.sitio : null;
  if (abierta) {
    const conCoords = data.sitios.find((s) => s.id === abierta.id);
    const distanciaM =
      conCoords?.lat != null && conCoords.lng != null && ubicacion
        ? distanciaMetros(ubicacion, { lat: conCoords.lat, lng: conCoords.lng })
        : null;
    return { nombre: abierta.nombre, tieneCoords: conCoords?.lat != null, distanciaM };
  }
  if (data.sitios.length === 0) return null;
  const cercano = ubicacion ? sitioMasCercano(data.sitios, ubicacion) : null;
  const sitio = cercano?.sitio ?? data.sitios[0];
  return { nombre: sitio.nombre, tieneCoords: sitio.lat !== null, distanciaM: cercano?.distanciaM ?? null };
}

/** Pantalla del guardia para marcar entrada, comida y salida (A-17, AS1-03). */
export function MarcarPage() {
  const queryClient = useQueryClient();
  const estado = useQuery({ queryKey: asistenciaService.keys.estado, queryFn: asistenciaService.estado });
  const [ubic, setUbic] = useState<EstadoUbicacion>({ estado: 'buscando' });
  const [pendiente, setPendiente] = useState<TipoMarcacion | null>(null);
  const [resultado, setResultado] = useState<Marcacion | null>(null);
  const [ahora, setAhora] = useState(() => new Date());

  const actualizarUbicacion = useCallback(async () => {
    setUbic({ estado: 'buscando' });
    try {
      setUbic({ estado: 'ok', ubicacion: await obtenerUbicacion() });
    } catch (err) {
      setUbic({ estado: 'error', error: err as SinUbicacionError });
    }
  }, []);

  useEffect(() => {
    void actualizarUbicacion();
    const reloj = setInterval(() => setAhora(new Date()), 30_000);
    return () => clearInterval(reloj);
  }, [actualizarUbicacion]);

  const marcar = useMutation({
    mutationFn: async (tipo: TipoMarcacion) => {
      // Ubicación fresca al momento de marcar (la de la pantalla puede ser de hace un rato).
      const ubicacion = await obtenerUbicacion({ fresca: true });
      setUbic({ estado: 'ok', ubicacion });
      return asistenciaService.marcar({ idCliente: nuevoIdMarca(), tipo, ...ubicacion });
    },
    onSuccess: (marca) => {
      setPendiente(null);
      setResultado(marca);
      void queryClient.invalidateQueries({ queryKey: asistenciaService.keys.all });
    },
    onError: (err) => {
      setPendiente(null);
      if (err instanceof SinUbicacionError) setUbic({ estado: 'error', error: err });
      toast.error(err instanceof Error ? err.message : 'No se pudo registrar la marca');
    },
  });

  if (estado.isPending) {
    return (
      <div className="flex justify-center py-16 text-brand-600">
        <Spinner className="size-8" />
      </div>
    );
  }
  if (estado.isError) {
    return (
      <EmptyState
        title="No se pudo cargar tu asistencia"
        description="Revisa tu conexión."
        action={<Button onClick={() => estado.refetch()}>Reintentar</Button>}
      />
    );
  }

  const data = estado.data;
  const ubicacion = ubic.estado === 'ok' ? ubic.ubicacion : null;
  const referencia = sitioDeReferencia(data, ubicacion);
  const sinSitio = data.permitidas.includes('entrada') && data.sitios.length === 0;
  const bloqueado = sinSitio || ubic.estado === 'error';

  return (
    <>
      <PageHeader title="Marcar asistencia" subtitle={formatDiaLargo(ahora)} />

      <div className="max-w-md space-y-4">
        <UbicacionCard
          ubic={ubic}
          referencia={referencia}
          sinSitio={sinSitio}
          onReintentar={() => void actualizarUbicacion()}
        />

        <div className="space-y-2">
          {BOTONES.map(({ tipo, icon: Icon }) => {
            const permitido = data.permitidas.includes(tipo) && !bloqueado;
            const principal = permitido && tipo === data.permitidas[0];
            return (
              <button
                key={tipo}
                type="button"
                disabled={!permitido}
                onClick={() => setPendiente(tipo)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-4 font-semibold transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                  principal
                    ? 'h-16 bg-brand-700 text-lg text-white shadow-sm active:bg-brand-900'
                    : permitido
                      ? 'h-13 bg-white text-slate-800 ring-1 ring-inset ring-slate-300 active:bg-slate-100'
                      : 'h-13 bg-slate-100 text-slate-400',
                )}
              >
                <Icon className={principal ? 'size-6' : 'size-5'} />
                {TIPO_MARCACION_LABEL[tipo]}
              </button>
            );
          })}
        </div>

        <HoyCard data={data} />

        <Link
          to="/marcar/historial"
          className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm font-medium text-brand-700 ring-1 ring-inset ring-slate-200 active:bg-slate-50"
        >
          Ver mis marcas <ChevronRight className="size-4" />
        </Link>
      </div>

      <ConfirmDialog
        open={pendiente !== null}
        title={pendiente ? CONFIRMAR[pendiente] : ''}
        description={
          <>
            {formatHora(new Date())}
            {referencia && ` · ${referencia.nombre}`}
          </>
        }
        confirmLabel="Registrar"
        loading={marcar.isPending}
        onConfirm={() => pendiente && marcar.mutate(pendiente)}
        onCancel={() => setPendiente(null)}
      />

      <ResultadoModal marca={resultado} onClose={() => setResultado(null)} />
    </>
  );
}

function UbicacionCard({
  ubic,
  referencia,
  sinSitio,
  onReintentar,
}: {
  ubic: EstadoUbicacion;
  referencia: ReturnType<typeof sitioDeReferencia>;
  sinSitio: boolean;
  onReintentar: () => void;
}) {
  if (sinSitio) {
    return (
      <Aviso tono="warning" icon={MapPinOff}>
        <p className="font-medium">Sin sitio asignado hoy</p>
        <p>Avisa a tu supervisor para que te asigne a un sitio.</p>
      </Aviso>
    );
  }
  if (ubic.estado === 'error') {
    return (
      <Aviso tono="error" icon={MapPinOff}>
        <p className="font-medium">Necesitamos tu ubicación</p>
        <p>{ubic.error.message}</p>
        <Button
          size="sm"
          variant="secondary"
          className="mt-2"
          icon={<RefreshCw className="size-4" />}
          onClick={onReintentar}
        >
          Reintentar
        </Button>
      </Aviso>
    );
  }

  const nombre = referencia?.nombre ?? '—';
  let detalle: React.ReactNode;
  let tono: 'ok' | 'warning' = 'ok';
  if (ubic.estado === 'buscando') {
    detalle = (
      <span className="flex items-center gap-2">
        <Spinner className="size-4" /> Obteniendo tu ubicación…
      </span>
    );
  } else if (!referencia?.tieneCoords) {
    tono = 'warning';
    detalle = 'El sitio no tiene ubicación registrada; tu marca llevará una alerta.';
  } else if (referencia.distanciaM !== null && referencia.distanciaM > RADIO_GEOCERCA_M) {
    tono = 'warning';
    detalle = `Estás a ${referencia.distanciaM} m del sitio; tu marca llevará una alerta.`;
  } else {
    detalle = (
      <span className="flex items-center gap-1.5">
        <CircleCheck className="size-4" /> Estás en el sitio
      </span>
    );
  }

  return (
    <Aviso tono={tono} icon={MapPin}>
      <p className="font-medium">{nombre}</p>
      <div>{detalle}</div>
    </Aviso>
  );
}

function Aviso({
  tono,
  icon: Icon,
  children,
}: {
  tono: 'ok' | 'warning' | 'error';
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex gap-3 rounded-xl p-4 text-sm',
        tono === 'ok' && 'bg-emerald-50 text-emerald-800',
        tono === 'warning' && 'bg-amber-50 text-amber-800',
        tono === 'error' && 'bg-red-50 text-red-700',
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 space-y-0.5">{children}</div>
    </div>
  );
}

/** Marcas de la jornada actual (o la última de las últimas horas). */
function HoyCard({ data }: { data: EstadoAsistencia }) {
  const j = data.jornada;
  const filas: { tipo: TipoMarcacion; marca: Marcacion | null }[] = j
    ? [
        { tipo: 'entrada', marca: j.entrada },
        { tipo: 'inicio_comida', marca: j.inicioComida },
        { tipo: 'fin_comida', marca: j.finComida },
        { tipo: 'salida', marca: j.salida },
      ]
    : [];

  return (
    <Card>
      <CardHeader title="Hoy" subtitle={j?.sitio?.nombre} />
      {j ? (
        <ul className="divide-y divide-slate-100">
          {filas.map(({ tipo, marca }) => (
            <li key={tipo} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className={marca ? 'text-slate-800' : 'text-slate-400'}>
                {TIPO_MARCACION_LABEL[tipo]}
              </span>
              <span className="flex items-center gap-1.5 font-medium tabular-nums">
                {marca ? formatHora(marca.registradaEn) : '—'}
                {marca &&
                  (marca.alertas.length ? (
                    <TriangleAlert className="size-4 text-amber-600" aria-label="Con alerta" />
                  ) : (
                    <CircleCheck className="size-4 text-emerald-600" aria-label="Registrada" />
                  ))}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <CardBody className="text-sm text-slate-500">Sin marcas todavía.</CardBody>
      )}
    </Card>
  );
}

function ResultadoModal({ marca, onClose }: { marca: Marcacion | null; onClose: () => void }) {
  const conAlerta = !!marca?.alertas.length;
  return (
    <Modal
      open={marca !== null}
      onClose={onClose}
      size="sm"
      title={marca ? `${TIPO_MARCACION_LABEL[marca.tipo]} registrada` : ''}
      footer={<Button onClick={onClose}>Listo</Button>}
    >
      {marca && (
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          {conAlerta ? (
            <TriangleAlert className="size-12 text-amber-500" />
          ) : (
            <CircleCheck className="size-12 text-emerald-600" />
          )}
          <p className="text-2xl font-bold tabular-nums text-slate-900">{formatHora(marca.registradaEn)}</p>
          {marca.sitio && <p className="text-slate-600">{marca.sitio.nombre}</p>}
          {conAlerta && (
            <div className="mt-2 w-full rounded-lg bg-amber-50 p-3 text-left text-sm text-amber-800">
              <p className="font-medium">Se registró con alerta; tu supervisor la verá:</p>
              <ul className="mt-1 list-inside list-disc">
                {marca.alertas.map((a) => (
                  <li key={a}>{ALERTA_MARCACION_LABEL[a]}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
