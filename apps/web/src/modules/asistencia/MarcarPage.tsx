import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight,
  CircleCheck,
  CloudOff,
  Coffee,
  LogIn,
  LogOut,
  MapPin,
  MapPinOff,
  RefreshCw,
  ScanFace,
  TriangleAlert,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import {
  ALERTA_MARCACION_LABEL,
  RADIO_GEOCERCA_M,
  TIPOS_CON_FOTO,
  TIPO_MARCACION_LABEL,
  TURNO_LABEL,
  distanciaMetros,
  horaLegible,
  textoDias,
  sitioMasCercano,
  type EstadoAsistencia,
  type Marcacion,
  type SitioMarcable,
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
import { CamaraMarca } from './CamaraMarca';
import { ConsejosCamara } from './rostro/ConsejosCamara';
import { pedirBienvenidaRostro } from './bienvenidaRostroEvento';
import { debeMostrarConsejos } from './rostro/consejos';
import { pedirSensorInclinacion } from './rostro/inclinacion';
import { TurnoGuardiaCard } from './TurnoGuardia';
import { useAuthStore } from '../../core/auth/authStore';
import { formatDiaLargo, formatHora } from './formato';
import { precargarMotor } from './rostro/motor';
import { HorasExtraGuardia } from './HorasExtraGuardia';
import { PlanDelDia } from './PlanDelDia';
import { RelevoTurnoModal } from './RelevoTurnoModal';
import { SinUbicacionError, nuevoIdMarca, obtenerUbicacion, type Ubicacion } from './ubicacion';
import { ApiError } from '../../core/api';
import { quitarMarca, useCola, type MarcaPendiente } from '../../core/offline/cola';
import { useEnLinea } from '../../core/offline/enLinea';
import { aplicarPendientes, comidasDe } from './estadoLocal';
import { guardarSinConexion, type DatosSinConexion } from './marcarSinConexion';

const BOTONES: { tipo: TipoMarcacion; icon: LucideIcon }[] = [
  { tipo: 'entrada', icon: LogIn },
  { tipo: 'inicio_comida', icon: Coffee },
  { tipo: 'fin_comida', icon: Utensils },
  { tipo: 'salida', icon: LogOut },
  // Solo aparece si extendió su horario después de checar su salida (AS5).
  { tipo: 'salida_extra', icon: LogOut },
];

const CONFIRMAR: Record<TipoMarcacion, string> = {
  entrada: '¿Checar tu entrada?',
  inicio_comida: '¿Salir a comer?',
  fin_comida: '¿Regresar de comer?',
  salida: '¿Checar tu salida?',
  salida_extra: '¿Checar tu salida final?',
};

/** Texto de cada botón del checador (DA-43). */
const ACCION: Record<TipoMarcacion, string> = {
  entrada: 'Checar entrada',
  inicio_comida: 'Salir a comer',
  fin_comida: 'Regresar de comer',
  salida: 'Checar salida',
  salida_extra: 'Checar salida final',
};

/** Título al terminar: "Entrada checada". */
const CHECADA: Record<TipoMarcacion, string> = {
  entrada: 'Entrada checada',
  inicio_comida: 'Salida a comer checada',
  fin_comida: 'Regreso de comer checado',
  salida: 'Salida checada',
  salida_extra: 'Salida final checada',
};

type EstadoUbicacion =
  | { estado: 'buscando' }
  | { estado: 'ok'; ubicacion: Ubicacion }
  | { estado: 'error'; error: SinUbicacionError };

/** "Turno de 24 h · entrada 8:00 a.m." según la asignación del sitio (DA-32). */
function horarioDe(s: SitioMarcable | undefined) {
  if (!s?.horaInicio) return null;
  if (s.horas) {
    return `Turno de ${s.horas} h · entrada ${horaLegible(s.horaInicio)}${s.dias ? ` · ${textoDias(s.dias).toLowerCase()}` : ''}`;
  }
  if (s.turno === '24x24' || s.turno === '12x12') {
    return `Turno de ${TURNO_LABEL[s.turno]} · entrada ${horaLegible(s.horaInicio)}`;
  }
  return s.horaFin ? `Horario ${horaLegible(s.horaInicio)} a ${horaLegible(s.horaFin)}` : null;
}

/** Sitio contra el que se mide: el de la jornada abierta o, si toca entrada, el asignado más cercano. */
function sitioDeReferencia(data: EstadoAsistencia, ubicacion: Ubicacion | null) {
  const abierta = data.jornada && !data.permitidas.includes('entrada') ? data.jornada.sitio : null;
  if (abierta) {
    const conCoords = data.sitios.find((s) => s.id === abierta.id);
    const distanciaM =
      conCoords?.lat != null && conCoords.lng != null && ubicacion
        ? distanciaMetros(ubicacion, { lat: conCoords.lat, lng: conCoords.lng })
        : null;
    return {
      nombre: abierta.nombre,
      tieneCoords: conCoords?.lat != null,
      distanciaM,
      radioM: conCoords?.radioM ?? RADIO_GEOCERCA_M,
      horario: horarioDe(conCoords),
    };
  }
  if (data.sitios.length === 0) return null;
  const cercano = ubicacion ? sitioMasCercano(data.sitios, ubicacion) : null;
  const sitio = cercano?.sitio ?? data.sitios[0];
  return {
    nombre: sitio.nombre,
    tieneCoords: sitio.lat !== null,
    distanciaM: cercano?.distanciaM ?? null,
    radioM: sitio.radioM ?? RADIO_GEOCERCA_M,
    horario: horarioDe(sitio),
  };
}

/** `85 m`, `2.3 km` */
const distanciaTexto = (m: number) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`);

/**
 * Entrada y salida solo dentro del sitio (DA-36): fuera del radio o con señal débil no se puede.
 * Sin coordenadas del sitio se permite (con alerta).
 */
function bloqueoGps(referencia: ReturnType<typeof sitioDeReferencia>, ubicacion: Ubicacion | null) {
  if (!referencia?.tieneCoords || !ubicacion) return null;
  if (ubicacion.precisionM > referencia.radioM) return 'senal' as const;
  if (referencia.distanciaM !== null && referencia.distanciaM > referencia.radioM) return 'lejos' as const;
  return null;
}

/** Pantalla del guardia para marcar entrada, comida y salida (A-17, AS1-03). */
export function MarcarPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const estado = useQuery({
    queryKey: asistenciaService.keys.estado,
    queryFn: asistenciaService.estado,
    // Para que la pregunta de horas extra aparezca sola al pasar la hora de salida (AS5).
    refetchInterval: () => (navigator.onLine ? 60_000 : false),
  });
  // Lo que ya checó sin conexión cuenta para saber qué sigue, aunque aún no llegue al servidor (AS2-02).
  const cola = useCola(user?.id);
  const enLinea = useEnLinea();
  const estadoData = useMemo(
    () => (estado.data ? aplicarPendientes(estado.data, cola) : undefined),
    [estado.data, cola],
  );
  // Si le toca entrada o salida (con cámara), el reconocimiento se carga y calienta desde ya.
  const conCamara = estadoData?.permitidas.some((t) => TIPOS_CON_FOTO.includes(t)) ?? false;
  useEffect(() => {
    if (!conCamara) return;
    const t = setTimeout(precargarMotor, 800);
    return () => clearTimeout(t);
  }, [conCamara]);
  const [ubic, setUbic] = useState<EstadoUbicacion>({ estado: 'buscando' });
  const [pendiente, setPendiente] = useState<TipoMarcacion | null>(null);
  const [resultado, setResultado] = useState<Marcacion | null>(null);
  /** Entrada o salida en curso con la cámara (AS1-08). */
  const [camara, setCamara] = useState<'entrada' | 'salida' | 'salida_extra' | null>(null);
  /** Modal de entrega y recepción de consignas (REP-07, REP-08). */
  const [relevo, setRelevo] = useState<'entrada' | 'salida' | null>(null);
  /** Consejos antes de abrir la cámara (quitarse lentes, buena luz...). */
  const [consejos, setConsejos] = useState<'entrada' | 'salida' | 'salida_extra' | null>(null);
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

  const ubicacionActual = ubic.estado === 'ok' ? ubic.ubicacion : null;
  const gpsBloquea =
    conCamara && estadoData
      ? bloqueoGps(sitioDeReferencia(estadoData, ubicacionActual), ubicacionActual)
      : null;
  useEffect(() => {
    if (!gpsBloquea) return;
    const t = setInterval(() => void actualizarUbicacion(), 15_000);
    return () => clearInterval(t);
  }, [gpsBloquea, actualizarUbicacion]);

  const abrirCamara = (tipo: 'entrada' | 'salida' | 'salida_extra') => {
    // Sin rostro registrado: primero la ventana que lo explica (con la guía del teléfono).
    if (estadoData && (estadoData.rostro.estado === 'sin_registro' || estadoData.rostro.estado === 'rechazado')) {
      pedirBienvenidaRostro();
      return;
    }
    if (debeMostrarConsejos()) {
      setConsejos(tipo);
      return;
    }
    pedirSensorInclinacion();
    setCamara(tipo);
  };

  // Desde la ventana "Tu turno empieza" (DA-40): abre directo la confirmación de relevo de entrada.
  const [params, setParams] = useSearchParams();
  const pideEntrada = params.get('checar') === 'entrada';
  useEffect(() => {
    if (!pideEntrada || !estadoData || ubic.estado === 'buscando') return;
    setParams({}, { replace: true });
    if (ubic.estado === 'ok' && !gpsBloquea && estadoData.permitidas.includes('entrada')) {
      setRelevo('entrada');
    }
  }, [pideEntrada, estadoData, ubic.estado, gpsBloquea, setParams]);

  /** Guarda en el celular una checada que no se pudo enviar (AS2-02). */
  const guardarLocal = (d: Pick<DatosSinConexion, 'idCliente' | 'tipo' | 'ubicacion'> & Partial<DatosSinConexion>) => {
    if (!estadoData || !user) throw new Error('No se pudo guardar la checada');
    const abierta = estadoData.jornada && !estadoData.permitidas.includes('entrada') ? estadoData.jornada.sitio : null;
    const cercano = sitioMasCercano(estadoData.sitios, d.ubicacion)?.sitio ?? estadoData.sitios[0];
    const sitio = abierta ?? (cercano ? { id: cercano.id, nombre: cercano.nombre } : null);
    return guardarSinConexion({
      usuarioId: user.id,
      sitio,
      comidas: d.tipo === 'entrada' ? comidasDe(cercano?.horas) : undefined,
      ...d,
    });
  };

  const marcar = useMutation({
    mutationFn: async (tipo: TipoMarcacion) => {
      // Ubicación fresca al momento de marcar (la de la pantalla puede ser de hace un rato).
      const ubicacion = await obtenerUbicacion({ fresca: true });
      setUbic({ estado: 'ok', ubicacion });
      const idCliente = nuevoIdMarca();
      // Sin conexión (o sin llegar al servidor) la comida se guarda en el celular y se envía sola.
      if (!navigator.onLine) return guardarLocal({ idCliente, tipo, ubicacion });
      try {
        return await asistenciaService.marcar({
          idCliente,
          tipo,
          ...ubicacion,
          horaCelular: new Date().toISOString(),
        });
      } catch (err) {
        if (err instanceof ApiError && err.code === 'NETWORK_ERROR') {
          return guardarLocal({ idCliente, tipo, ubicacion });
        }
        throw err;
      }
    },
    onSuccess: (marca) => {
      setPendiente(null);
      setResultado(marca);
      void queryClient.invalidateQueries({ queryKey: asistenciaService.keys.all });
    },
    onError: (err) => {
      setPendiente(null);
      if (err instanceof SinUbicacionError) setUbic({ estado: 'error', error: err });
      toast.error(err instanceof Error ? err.message : 'No se pudo checar');
    },
  });

  if (estado.isPending || (estado.data && !estadoData)) {
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

  const data = estadoData!;
  const ubicacion = ubic.estado === 'ok' ? ubic.ubicacion : null;
  const referencia = sitioDeReferencia(data, ubicacion);
  const sinSitio = data.permitidas.includes('entrada') && data.sitios.length === 0;
  const bloqueado = sinSitio || ubic.estado === 'error';
  const gps = bloqueoGps(referencia, ubicacion);

  return (
    <>
      <PageHeader title={`Hola, ${user?.nombre ?? ''}`} subtitle={formatDiaLargo(ahora)} />

      <div className="max-w-md space-y-4">
        <SinConexionAviso enLinea={enLinea} pendientes={cola} />
        <TurnoGuardiaCard estado={data} />
        <UbicacionCard
          ubic={ubic}
          referencia={referencia}
          sinSitio={sinSitio}
          gps={conCamara ? gps : null}
          onReintentar={() => void actualizarUbicacion()}
        />

        {data.plan && <PlanDelDia plan={data.plan} />}
        {data.horaExtra && (
          <HorasExtraGuardia
            extra={data.horaExtra}
            conPlan={data.plan?.estado === 'resuelto'}
            ubicacion={ubicacion}
            dentroDelSitio={
              referencia?.tieneCoords && referencia.distanciaM !== null
                ? referencia.distanciaM <= referencia.radioM
                : referencia && !referencia.tieneCoords
                  ? true
                  : null
            }
          />
        )}

        <div className="space-y-2">
          {BOTONES.filter(({ tipo }) => tipo !== 'salida_extra' || data.permitidas.includes(tipo)).map(({ tipo, icon: Icon }) => {
            // Entrada y salida requieren estar en el sitio; la comida no (DA-36).
            const permitido =
              data.permitidas.includes(tipo) && !bloqueado && !(gps && TIPOS_CON_FOTO.includes(tipo));
            const principal = permitido && tipo === data.permitidas[0];

            return (
              <button
                key={tipo}
                type="button"
                disabled={!permitido}
                onClick={() => {
                  if (tipo === 'entrada' || tipo === 'salida') {
                    setRelevo(tipo);
                  } else if (tipo === 'salida_extra') {
                    // La salida final no lleva consignas: ya las entregó en su salida.
                    abrirCamara(tipo);
                  } else {
                    setPendiente(tipo);
                  }
                }}
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
                {ACCION[tipo]}
                {/* Turnos de 24 h: dos comidas (DA-47). Solo mostrar conteo si la jornada está activa */}
                {tipo === 'inicio_comida' &&
                  !data.permitidas.includes('entrada') &&
                  data.jornada &&
                  !data.jornada.salida &&
                  data.jornada.comidasPermitidas > 1 && (
                    <span className="text-sm font-normal opacity-80">
                      (
                      {Math.min(
                        data.jornada.comidas.filter((c) => c.fin !== null).length + 1,
                        data.jornada.comidasPermitidas,
                      )}{' '}
                      de {data.jornada.comidasPermitidas})
                    </span>
                  )}
                {/* Indicador de salida bloqueada por comida pendiente */}
                {tipo === 'salida' &&
                  !data.permitidas.includes('salida') &&
                  !data.permitidas.includes('entrada') &&
                  data.jornada &&
                  !data.jornada.salida && (
                    <span className="ml-auto text-xs font-normal opacity-70">
                      {data.jornada.comidasPermitidas > 1 &&
                      data.jornada.comidas.filter((c) => c.fin !== null).length > 0
                        ? `Falta comida (${data.jornada.comidas.filter((c) => c.fin !== null).length}/${data.jornada.comidasPermitidas})`
                        : 'Primero registra tu comida'}
                    </span>
                  )}
              </button>
            );
          })}
        </div>

        {data.rostro.estado === 'pendiente' && (
          <Aviso tono="ok" icon={ScanFace}>
            <p className="font-medium">Tu rostro está en revisión</p>
            <p>Puedes checar normalmente; tu supervisor lo aprobará pronto.</p>
          </Aviso>
        )}
        {data.rostro.estado === 'sin_registro' && (
          <Aviso tono="warning" icon={ScanFace}>
            <p className="font-medium">Falta registrar tu rostro</p>
            <p>Lo necesitas para poder checar. Solo se hace una vez.</p>
            <button
              type="button"
              onClick={pedirBienvenidaRostro}
              className="mt-2 inline-flex h-10 items-center rounded-lg bg-amber-700 px-4 font-medium text-white active:bg-amber-800"
            >
              Registrar mi rostro
            </button>
          </Aviso>
        )}
        {data.rostro.estado === 'rechazado' && (
          <Aviso tono="warning" icon={ScanFace}>
            <p className="font-medium">Tu registro de rostro fue rechazado</p>
            <p>
              {data.rostro.motivoRechazo ? `Motivo: ${data.rostro.motivoRechazo}. ` : ''}Regístralo de nuevo
              para poder checar.
            </p>
            <button
              type="button"
              onClick={pedirBienvenidaRostro}
              className="mt-2 inline-flex h-10 items-center rounded-lg bg-amber-700 px-4 font-medium text-white active:bg-amber-800"
            >
              Registrar mi rostro
            </button>
          </Aviso>
        )}

        <HoyCard data={data} />

        <Link
          to="/marcar/historial"
          className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm font-medium text-brand-700 ring-1 ring-inset ring-slate-200 active:bg-slate-50"
        >
          Ver mis checadas <ChevronRight className="size-4" />
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

      {consejos && (
        <ConsejosCamara
          onCancelar={() => setConsejos(null)}
          onContinuar={() => {
            setCamara(consejos);
            setConsejos(null);
          }}
        />
      )}

      {camara && (
        <CamaraMarca
          tipo={camara}
          sitio={referencia?.nombre ?? null}
          registrarRostro={data.rostro.estado === 'sin_registro' || data.rostro.estado === 'rechazado'}
          motivoRechazo={data.rostro.motivoRechazo}
          onCerrar={() => setCamara(null)}
          guardarSinConexion={(c, ubicacion, intento, idCliente) =>
            guardarLocal({
              idCliente,
              tipo: camara,
              ubicacion,
              foto: c.foto,
              descriptor: c.descriptor ?? undefined,
              conLentes: c.conLentes,
              intento,
            })
          }
          onRegistrada={(marca) => {
            setCamara(null);
            setResultado(marca);
            void queryClient.invalidateQueries({ queryKey: asistenciaService.keys.all });
            void queryClient.invalidateQueries({ queryKey: ['reportes'] });
          }}
        />
      )}

      {relevo && (
        <RelevoTurnoModal
          tipo={relevo}
          sitio={
            data.jornada?.sitio ??
            (referencia?.nombre ? data.sitios.find((s) => s.nombre === referencia.nombre) : null) ??
            data.sitios[0] ??
            null
          }
          ubicacion={ubicacion}
          onCancelar={() => setRelevo(null)}
          onContinuar={() => {
            const t = relevo;
            setRelevo(null);
            abrirCamara(t);
          }}
        />
      )}

      <ResultadoModal marca={resultado} onClose={() => setResultado(null)} />
    </>
  );
}

function UbicacionCard({
  ubic,
  referencia,
  sinSitio,
  gps,
  onReintentar,
}: {
  ubic: EstadoUbicacion;
  referencia: ReturnType<typeof sitioDeReferencia>;
  sinSitio: boolean;
  /** Bloqueo de entrada/salida por GPS (DA-36). */
  gps: ReturnType<typeof bloqueoGps>;
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
  if (gps && referencia && ubic.estado === 'ok') {
    return (
      <Aviso tono="error" icon={gps === 'lejos' ? MapPinOff : MapPin}>
        <p className="font-medium">{nombre}</p>
        {referencia.horario && <p className="text-sm opacity-90">{referencia.horario}</p>}
        <p>
          {gps === 'lejos'
            ? `Estás a ${distanciaTexto(referencia.distanciaM!)} del sitio. Acércate (máximo ${referencia.radioM} m) para registrar tu entrada o salida.`
            : `La señal de tu GPS es débil (±${Math.round(ubic.ubicacion.precisionM)} m). Sal a un lugar abierto e intenta de nuevo.`}
        </p>
        <Button
          size="sm"
          variant="secondary"
          className="mt-2"
          icon={<RefreshCw className="size-4" />}
          onClick={onReintentar}
        >
          Actualizar ubicación
        </Button>
      </Aviso>
    );
  }
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
    detalle = 'El sitio no tiene ubicación registrada; tu checada llevará una alerta.';
  } else if (referencia.distanciaM !== null && referencia.distanciaM > referencia.radioM) {
    // Solo llega aquí si no toca entrada ni salida (la comida se permite con alerta).
    tono = 'warning';
    detalle = `Estás a ${distanciaTexto(referencia.distanciaM)} del sitio; tu checada llevará una alerta.`;
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
      {referencia?.horario && <p className="text-sm opacity-90">{referencia.horario}</p>}
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
  const varias = !!j && j.comidasPermitidas > 1;
  const comidas = j ? (j.comidas.length ? j.comidas : [{ inicio: null, fin: null }]) : [];
  const filas: { clave: string; texto: string; marca: Marcacion | null }[] = j
    ? [
        { clave: 'entrada', texto: TIPO_MARCACION_LABEL.entrada, marca: j.entrada },
        ...comidas.flatMap((c, i) => [
          {
            clave: `inicio-${i}`,
            texto: `Salió a comer${varias ? ` (${i + 1})` : ''}`,
            marca: c.inicio,
          },
          { clave: `fin-${i}`, texto: `Regresó de comer${varias ? ` (${i + 1})` : ''}`, marca: c.fin },
        ]),
        { clave: 'salida', texto: TIPO_MARCACION_LABEL.salida, marca: j.salida },
      ]
    : [];

  return (
    <Card>
      <CardHeader title="Hoy" subtitle={j?.sitio?.nombre} />
      {j ? (
        <ul className="divide-y divide-slate-100">
          {filas.map(({ clave, texto, marca }) => (
            <li key={clave} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className={marca ? 'text-slate-800' : 'text-slate-400'}>{texto}</span>
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
        <CardBody className="text-sm text-slate-500">Sin checadas todavía.</CardBody>
      )}
    </Card>
  );
}

function ResultadoModal({ marca, onClose }: { marca: Marcacion | null; onClose: () => void }) {
  // Id negativo: se guardó en el celular y aún no llega al servidor.
  const local = !!marca && marca.id < 0;
  const conAlerta = !!marca?.alertas.length && !local;
  return (
    <Modal
      open={marca !== null}
      onClose={onClose}
      size="sm"
      title={marca ? CHECADA[marca.tipo] : ''}
      footer={<Button onClick={onClose}>Listo</Button>}
    >
      {marca && (
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          {local ? (
            <CloudOff className="size-12 text-amber-500" />
          ) : conAlerta ? (
            <TriangleAlert className="size-12 text-amber-500" />
          ) : (
            <CircleCheck className="size-12 text-emerald-600" />
          )}
          <p className="text-2xl font-bold tabular-nums text-slate-900">{formatHora(marca.registradaEn)}</p>
          {marca.sitio && <p className="text-slate-600">{marca.sitio.nombre}</p>}
          {local && (
            <div className="mt-2 w-full rounded-lg bg-amber-50 p-3 text-left text-sm text-amber-800">
              <p className="font-medium">Guardada en tu celular</p>
              <p>No hay conexión. Tu checada ya cuenta con la hora de ahora y se enviará sola cuando haya señal.</p>
            </div>
          )}
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

/** Aviso de "sin conexión" y de las checadas guardadas que aún no se envían (AS2-02). */
function SinConexionAviso({ enLinea, pendientes }: { enLinea: boolean; pendientes: MarcaPendiente[] }) {
  const [descartando, setDescartando] = useState<MarcaPendiente | null>(null);
  if (enLinea && pendientes.length === 0) return null;
  const conError = pendientes.filter((m) => m.error);
  return (
    <div className="space-y-2">
      {!enLinea && (
        <Aviso tono="warning" icon={CloudOff}>
          <p className="font-medium">Sin conexión</p>
          <p>Puedes checar normal: se guarda en tu celular y se envía sola cuando vuelva la señal.</p>
        </Aviso>
      )}
      {pendientes.length > 0 && (
        <div className="rounded-xl bg-white p-4 text-sm ring-1 ring-slate-200 ring-inset">
          <p className="font-medium text-slate-900">
            {pendientes.length === 1
              ? '1 checada pendiente de enviar'
              : pendientes.length + ' checadas pendientes de enviar'}
          </p>
          <ul className="mt-1 space-y-1">
            {pendientes.map((m) => (
              <li key={m.idCliente} className="flex items-center justify-between gap-2 text-slate-600">
                <span>
                  {CHECADA[m.tipo]} · {formatHora(m.capturadaEn)}
                  {m.error && <span className="block text-xs text-red-700">{m.error}</span>}
                </span>
                {m.error && (
                  <Button size="sm" variant="secondary" onClick={() => setDescartando(m)}>
                    Descartar
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {conError.length > 0 && (
            <p className="mt-2 text-xs text-red-700">
              El servidor rechazó una checada; las siguientes esperan. Avisa a tu supervisor o descártala.
            </p>
          )}
        </div>
      )}
      <ConfirmDialog
        open={descartando !== null}
        title="Descartar checada"
        description="Esta checada no se enviará y no quedará registrada. ¿Descartarla?"
        confirmLabel="Descartar"
        variant="danger"
        onConfirm={() => {
          if (descartando) void quitarMarca(descartando.idCliente);
          setDescartando(null);
        }}
        onCancel={() => setDescartando(null)}
      />
    </div>
  );
}
