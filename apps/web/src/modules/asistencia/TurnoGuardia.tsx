import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CircleCheck, MapPin, Moon, Shuffle, Timer, Utensils } from 'lucide-react';
import {
  COMIDA_MIN,
  PERMISOS,
  RADIO_GEOCERCA_M,
  ROLES,
  distanciaMetros,
  type EstadoAsistencia,
  type TurnoDelGuardia,
} from '@platinum/shared';
import { Button, Modal, Spinner, cn, toast } from '../../components/ui';
import { hasPermission, hasRole, useAuthStore } from '../../core/auth/authStore';
import { asistenciaService } from './asistencia.service';
import { formatDia, formatHora } from './formato';
import { nuevoIdMarca, obtenerUbicacion } from './ubicacion';

/** `85 m`, `1.2 km` */
const distanciaTexto = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

const esHoy = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();
const cuando = (iso: string) =>
  esHoy(iso) ? `hoy a las ${formatHora(iso)}` : `${formatDia(iso)}, ${formatHora(iso)}`;

function NotaCobertura({ turno }: { turno: TurnoDelGuardia }) {
  if (!turno.cobertura) return null;
  return (
    <p className="mt-1 flex items-start gap-1.5 text-sm">
      <Shuffle className="mt-0.5 size-4 shrink-0" />
      <span>
        Cubres este sitio{turno.cobertura.cubreA ? ` en lugar de ${turno.cobertura.cubreA}` : ''}. Motivo:{' '}
        {turno.cobertura.motivo}
      </span>
    </p>
  );
}

/**
 * Tarjeta del turno del guardia en el checador (DA-40): en turno, por empezar, o descansando con su
 * próximo turno. Si cubre otro sitio, lo dice.
 */
export function TurnoGuardiaCard({ estado }: { estado: EstadoAsistencia }) {
  const { turnoActual: actual, proximoTurno: proximo } = estado;
  if (actual) {
    const enTurno = !estado.permitidas.includes('entrada');
    const empezo = Date.parse(actual.entrada) <= Date.now();
    return (
      <div
        className={cn(
          'rounded-xl px-4 py-3 ring-1 ring-inset',
          enTurno
            ? 'bg-emerald-50 text-emerald-900 ring-emerald-200'
            : empezo
              ? 'bg-amber-50 text-amber-900 ring-amber-200'
              : 'bg-brand-50 text-brand-900 ring-brand-200',
        )}
      >
        <p className="flex items-center gap-2 font-semibold">
          {enTurno ? <CircleCheck className="size-5" /> : <Timer className="size-5" />}
          {enTurno
            ? `En turno en ${actual.sitio.nombre}`
            : `Tu turno ${empezo ? 'empezó' : 'empieza'} a las ${formatHora(actual.entrada)}`}
        </p>
        <p className="text-sm">
          {enTurno
            ? `Sales ${cuando(actual.salida)}`
            : `${actual.sitio.nombre} · sales ${cuando(actual.salida)}`}
        </p>
        <NotaCobertura turno={actual} />
      </div>
    );
  }
  if (!proximo) return null;
  return (
    <div className="rounded-xl bg-white px-4 py-3 text-slate-800 ring-1 ring-inset ring-slate-200">
      <p className="flex items-center gap-2 font-semibold">
        <Moon className="size-5 text-slate-500" />{' '}
        {esHoy(proximo.entrada) ? 'Aún no es tu turno' : 'Descansas hoy'}
      </p>
      <p className="flex items-center gap-1.5 text-sm text-slate-600">
        <CalendarClock className="size-4 shrink-0" />
        Tu próximo turno: {cuando(proximo.entrada)} en {proximo.sitio.nombre}
      </p>
      <NotaCobertura turno={proximo} />
    </div>
  );
}

type Ubicacion = { estado: 'buscando' } | { estado: 'ok'; distanciaM: number | null } | { estado: 'error' };

/** Distancia en vivo al sitio mientras la ventana está abierta. */
function useDistancia(sitio: TurnoDelGuardia['sitio'] | null) {
  const [ubic, setUbic] = useState<Ubicacion>({ estado: 'buscando' });
  useEffect(() => {
    if (!sitio || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) =>
        setUbic({
          estado: 'ok',
          distanciaM:
            sitio.lat === null || sitio.lng === null
              ? null
              : distanciaMetros(
                  { lat: p.coords.latitude, lng: p.coords.longitude },
                  { lat: sitio.lat, lng: sitio.lng },
                ),
        }),
      () => setUbic({ estado: 'error' }),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [sitio]);
  return ubic;
}

const clave = (t: TurnoDelGuardia) => `asistencia.ventanaTurno.${t.entrada}`;
const omitida = (t: TurnoDelGuardia) => {
  try {
    return sessionStorage.getItem(clave(t)) === '1';
  } catch {
    return false;
  }
};

/**
 * Al abrir la app (DA-40): si le toca entrar (30 min antes o ya es hora) y no ha checado, una
 * ventana con su turno, la distancia al sitio en vivo y "Checar entrada". "Ahora no" la oculta
 * hasta que vuelva a abrir la app. No sale mientras falte registrar su rostro (eso va primero).
 */
export function VentanaTurno() {
  const user = useAuthStore((s) => s.user);
  const esGuardia = hasRole(user, [ROLES.GUARDIA]) && hasPermission(user, PERMISOS.ASISTENCIA_MARCAR);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [cerrada, setCerrada] = useState(false);
  const estado = useQuery({
    queryKey: asistenciaService.keys.estado,
    queryFn: asistenciaService.estado,
    enabled: esGuardia,
    refetchInterval: 60_000,
  });
  const d = estado.data;
  const turno = d?.turnoActual ?? null;
  const sinRostro = d?.rostro.estado === 'sin_registro' || d?.rostro.estado === 'rechazado';
  const visible =
    esGuardia &&
    !!turno &&
    !!d?.permitidas.includes('entrada') &&
    !sinRostro &&
    !cerrada &&
    !omitida(turno) &&
    pathname !== '/marcar';
  const ubic = useDistancia(visible ? turno!.sitio : null);

  if (!visible || !turno) return null;
  const radio = turno.sitio.radioM ?? RADIO_GEOCERCA_M;
  const empezo = Date.parse(turno.entrada) <= Date.now();
  const ahoraNo = () => {
    try {
      sessionStorage.setItem(clave(turno), '1');
    } catch {
      // Sin almacenamiento: solo se cierra por ahora.
    }
    setCerrada(true);
  };

  return (
    <Modal
      open
      onClose={ahoraNo}
      size="sm"
      title={`Tu turno ${empezo ? 'empezó' : 'empieza'} a las ${formatHora(turno.entrada)}`}
      description={turno.sitio.nombre}
      footer={
        <>
          <Button variant="secondary" onClick={ahoraNo}>
            Ahora no
          </Button>
          <Button
            icon={<Timer className="size-4" />}
            onClick={() => {
              setCerrada(true);
              navigate('/marcar?checar=entrada');
            }}
          >
            Checar entrada
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium',
            ubic.estado === 'ok' && ubic.distanciaM !== null && ubic.distanciaM <= radio
              ? 'bg-emerald-50 text-emerald-800'
              : 'bg-slate-50 text-slate-700',
          )}
          role="status"
        >
          {ubic.estado === 'buscando' ? (
            <>
              <Spinner className="size-4" /> Buscando tu ubicación…
            </>
          ) : ubic.estado === 'error' ? (
            <>
              <MapPin className="size-4" /> Activa tu ubicación para checar
            </>
          ) : ubic.distanciaM === null ? (
            <>
              <MapPin className="size-4" /> El sitio no tiene ubicación registrada
            </>
          ) : ubic.distanciaM <= radio ? (
            <>
              <CircleCheck className="size-4" /> Ya estás en el sitio
            </>
          ) : (
            <>
              <MapPin className="size-4" /> Estás a {distanciaTexto(ubic.distanciaM)} del sitio: acércate para
              checar
            </>
          )}
        </p>
        <p className="text-sm text-slate-600">Sales {cuando(turno.salida)}</p>
        <NotaCobertura turno={turno} />
      </div>
    </Modal>
  );
}

/**
 * Hora de comida vencida (DA-47): al pasar 1 h desde que salió a comer, una ventana con
 * [Regresar de comer] para cerrarla con un toque (sin foto; toma el GPS). "Ahora no" la oculta
 * hasta que vuelva a abrir la app.
 */
export function VentanaComida() {
  const user = useAuthStore((s) => s.user);
  const esGuardia = hasRole(user, [ROLES.GUARDIA]) && hasPermission(user, PERMISOS.ASISTENCIA_MARCAR);
  const qc = useQueryClient();
  const [, setTic] = useState(0);
  const [cerrada, setCerrada] = useState<number | null>(null);
  const estado = useQuery({
    queryKey: asistenciaService.keys.estado,
    queryFn: asistenciaService.estado,
    enabled: esGuardia,
    refetchInterval: 60_000,
  });
  // Se revisa cada 30 s aunque el estado no cambie (la hora sí).
  useEffect(() => {
    const t = setInterval(() => setTic((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const regresar = useMutation({
    mutationFn: async () => {
      const ubicacion = await obtenerUbicacion({ fresca: true });
      return asistenciaService.marcar({ idCliente: nuevoIdMarca(), tipo: 'fin_comida', ...ubicacion });
    },
    onSuccess: () => {
      toast.success('Regreso de comida checado');
      void qc.invalidateQueries({ queryKey: asistenciaService.keys.all });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo checar'),
  });

  const j = estado.data?.jornada;
  const comida = j && !j.salida ? j.comidas.at(-1) : undefined;
  const abierta = comida && !comida.fin ? comida : null;
  const min = abierta ? Math.floor((Date.now() - Date.parse(abierta.inicio.registradaEn)) / 60_000) : 0;
  const clave = abierta && `asistencia.ventanaComida.${abierta.inicio.id}`;
  let omitida = false;
  try {
    omitida = !!clave && sessionStorage.getItem(clave) === '1';
  } catch {
    // Sin almacenamiento: se sigue mostrando.
  }
  if (!esGuardia || !abierta || min < COMIDA_MIN || omitida || cerrada === abierta.inicio.id) return null;

  const ahoraNo = () => {
    try {
      sessionStorage.setItem(clave!, '1');
    } catch {
      // Sin almacenamiento: solo se cierra por ahora.
    }
    setCerrada(abierta.inicio.id);
  };
  return (
    <Modal
      open
      onClose={ahoraNo}
      size="sm"
      title="Ya pasó tu hora de comida"
      description={`Saliste a comer a las ${formatHora(abierta.inicio.registradaEn)} (hace ${min} min)`}
      footer={
        <>
          <Button variant="secondary" onClick={ahoraNo}>
            Ahora no
          </Button>
          <Button
            icon={<Utensils className="size-4" />}
            loading={regresar.isPending}
            onClick={() => regresar.mutate()}
          >
            Regresar de comer
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">
        Si ya regresaste, regístralo aquí con un toque. Si pasa mucho tiempo sin registrarlo, se le avisa a tu
        supervisor.
      </p>
    </Modal>
  );
}
