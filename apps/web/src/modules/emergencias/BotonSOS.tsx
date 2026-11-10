import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, MapPin, Phone, Siren, X } from 'lucide-react';
import {
  SEGUNDOS_PRESIONAR_SOS,
  TIPOS_EMERGENCIA,
  TIPO_EMERGENCIA_LABEL,
  type Emergencia,
  type EmergenciaCreateInput,
} from '@platinum/shared';
import { Button, Spinner, cn, toast } from '../../components/ui';
import { mensajeDeError } from '../../core/api';
import { formatFechaHora } from '../../core/format/fechas';
import { emergenciasService } from './emergencias.service';

const RADIO = 28;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

type Posicion = Pick<EmergenciaCreateInput, 'lat' | 'lng' | 'precisionM'>;

/** Pide la ubicación sin bloquear: si el GPS no responde, la alerta sale sin ella. */
function pedirUbicacion(): Promise<Posicion> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({});
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, precisionM: Math.round(p.coords.accuracy) }),
      () => resolve({}),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 30_000 },
    );
  });
}

async function bateria(): Promise<number | undefined> {
  try {
    const b = await (navigator as Navigator & { getBattery?: () => Promise<{ level: number }> }).getBattery?.();
    return b ? Math.round(b.level * 100) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Botón de pánico (A-60): flotante, en todas las pantallas. Se mantiene presionado 2 segundos (con un anillo que
 * se llena) para que no se active por accidente; al completarse la alerta sale de inmediato, sin preguntar nada.
 * La ventana "Alerta enviada" se abre sola al enviar y cuando alguien la recibe; se puede cerrar (la alerta sigue
 * activa) y queda una franja roja para volver a abrirla.
 */
export function BotonSOS() {
  const qc = useQueryClient();
  const mia = useQuery({
    queryKey: emergenciasService.keys.mia,
    queryFn: emergenciasService.mia,
    // Mientras hay una alerta activa se consulta seguido para mostrar quién respondió.
    refetchInterval: (q) => (q.state.data ? 4000 : 30_000),
  });
  const [progreso, setProgreso] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [falloEnvio, setFalloEnvio] = useState(false);
  const inicio = useRef<number | null>(null);
  const raf = useRef(0);
  const ubicacion = useRef<Promise<Posicion> | null>(null);
  // Ventana "Alerta enviada" abierta o minimizada en la franja.
  const [abierta, setAbierta] = useState(false);

  const enviar = useCallback(async () => {
    setEnviando(true);
    setFalloEnvio(false);
    try {
      // Se espera la ubicación solo un instante: en una emergencia lo importante es que salga ya.
      const pos = await Promise.race([
        ubicacion.current ?? pedirUbicacion(),
        new Promise<Posicion>((r) => setTimeout(() => r({}), 1500)),
      ]);
      const e = await emergenciasService.crear({ ...pos, bateria: await bateria() });
      qc.setQueryData(emergenciasService.keys.mia, e);
      setAbierta(true);
      navigator.vibrate?.([300, 100, 300]);
    } catch (err) {
      setFalloEnvio(true);
      toast.error(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }, [qc]);

  const parar = useCallback(() => {
    inicio.current = null;
    cancelAnimationFrame(raf.current);
    setProgreso(0);
  }, []);

  const empezar = () => {
    if (enviando) return;
    inicio.current = performance.now();
    ubicacion.current = pedirUbicacion();
    const paso = () => {
      if (inicio.current == null) return;
      const p = Math.min(1, (performance.now() - inicio.current) / (SEGUNDOS_PRESIONAR_SOS * 1000));
      setProgreso(p);
      if (p >= 1) {
        parar();
        void enviar();
        return;
      }
      raf.current = requestAnimationFrame(paso);
    };
    raf.current = requestAnimationFrame(paso);
  };

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const activa = mia.data;
  // Quién la recibió la última vez que se vio: si pasa de nadie a alguien, la ventana se abre sola. Al recargar con una
  // alerta ya activa no se abre a pantalla completa: queda la franja.
  const acusadaAntes = useRef<string | null | undefined>(undefined);
  const acusadaAhora = activa ? (activa.acusadaPor ?? null) : undefined;
  useEffect(() => {
    if (acusadaAhora === undefined) {
      setAbierta(false);
    } else if (acusadaAntes.current === null && acusadaAhora !== null) {
      setAbierta(true);
    }
    acusadaAntes.current = acusadaAhora;
  }, [acusadaAhora]);

  return (
    <>
      <button
        type="button"
        aria-label="Botón de emergencia: mantén presionado 2 segundos"
        title="Mantén presionado 2 segundos"
        onPointerDown={empezar}
        onPointerUp={parar}
        onPointerLeave={parar}
        onPointerCancel={parar}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) empezar();
        }}
        onKeyUp={parar}
        disabled={enviando}
        className="fixed right-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 grid size-14 touch-none place-items-center rounded-full bg-red-600 text-white shadow-lg ring-2 ring-white select-none md:right-6 md:bottom-6"
      >
        <svg className="pointer-events-none absolute inset-0 size-14 -rotate-90" viewBox="0 0 64 64" aria-hidden>
          <circle
            cx="32"
            cy="32"
            r={RADIO}
            fill="none"
            stroke="white"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={CIRCUNFERENCIA}
            strokeDashoffset={CIRCUNFERENCIA * (1 - progreso)}
          />
        </svg>
        {enviando ? <Spinner className="size-5" /> : <span className="text-sm font-extrabold tracking-wide">SOS</span>}
      </button>
      {progreso > 0 && (
        <p className="fixed right-3 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] z-40 rounded-lg bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-white md:right-6 md:bottom-24">
          Sigue presionando…
        </p>
      )}
      {falloEnvio && !activa && (
        <FalloEnvio onReintentar={() => void enviar()} onCerrar={() => setFalloEnvio(false)} />
      )}
      {activa && abierta && <EstadoAlerta emergencia={activa} onCerrar={() => setAbierta(false)} />}
      {activa && !abierta && (
        <button
          type="button"
          onClick={() => setAbierta(true)}
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-3 right-20 z-40 flex h-10 items-center justify-center gap-2 rounded-full bg-red-600 px-4 text-sm font-semibold text-white shadow-lg ring-2 ring-white md:right-24 md:left-auto md:bottom-8"
        >
          <Siren className="size-4 shrink-0" /> Alerta activa · Ver estado
        </button>
      )}
    </>
  );
}

/** Capa a pantalla completa. Con `onCerrar` se cierra al tocar fuera o con Escape. */
function Capa({ children, onCerrar }: { children: React.ReactNode; onCerrar?: () => void }) {
  useEffect(() => {
    if (!onCerrar) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/60 p-0 md:items-center md:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar?.();
      }}
    >
      <div className="pb-safe max-h-dvh w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl md:max-w-md md:rounded-2xl">
        {children}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Los botones abren el marcador del teléfono con el número escrito: la persona debe presionar llamar (la web no
 * puede marcar sola). En computadora no hacen nada útil, por eso solo se muestran en celulares.
 */
function Marcador({ supervisor }: { supervisor?: Emergencia['supervisor'] }) {
  return (
    <div className="hidden space-y-2 pointer-coarse:block">
      {supervisor?.telefono && (
        <a
          href={`tel:${supervisor.telefono}`}
          className="flex h-12 items-center justify-center gap-2 rounded-lg bg-slate-800 font-semibold text-white"
        >
          <Phone className="size-5" /> Llamar a {supervisor.nombre.split(' ')[0]}
          <span className="text-xs font-normal text-slate-300">
            ({supervisor.telefonoEtiqueta === 'personal' ? 'personal' : 'empresa'})
          </span>
        </a>
      )}
      <a
        href="tel:911"
        className="flex h-12 items-center justify-center gap-2 rounded-lg bg-red-600 font-semibold text-white"
      >
        <Phone className="size-5" /> Abrir marcador (911)
      </a>
      <p className="text-center text-xs text-slate-500">Se abrirá tu teléfono: presiona el botón verde para llamar.</p>
    </div>
  );
}

function FalloEnvio({ onReintentar, onCerrar }: { onReintentar: () => void; onCerrar: () => void }) {
  return (
    <Capa onCerrar={onCerrar}>
      <div className="space-y-3 p-5">
        <h2 className="text-lg font-bold text-red-700">No se pudo enviar la alerta</h2>
        <p className="text-sm text-slate-700">
          Parece que no hay internet. Llama directo a tu supervisor o al 911.
        </p>
        <Marcador />
        <div className="flex gap-2">
          <Button className="flex-1" onClick={onReintentar}>
            Reintentar
          </Button>
          <Button className="flex-1" variant="secondary" onClick={onCerrar}>
            Cerrar
          </Button>
        </div>
      </div>
    </Capa>
  );
}

/** Lo que ve quien lanzó la alerta: si ya la recibieron, qué tipo es y la salida "fue sin querer". */
function EstadoAlerta({ emergencia: e, onCerrar }: { emergencia: Emergencia; onCerrar: () => void }) {
  const qc = useQueryClient();
  const refrescar = (nueva: Emergencia | null) => {
    qc.setQueryData(emergenciasService.keys.mia, nueva);
    void qc.invalidateQueries({ queryKey: emergenciasService.keys.all });
    void qc.invalidateQueries({ queryKey: ['avisos'] });
  };
  const tipo = useMutation({
    mutationFn: (t: (typeof TIPOS_EMERGENCIA)[number]) => emergenciasService.tipo(e.id, { tipo: t }),
    onSuccess: refrescar,
    onError: (err) => toast.error(mensajeDeError(err)),
  });
  const cancelar = useMutation({
    mutationFn: () => emergenciasService.cancelar(e.id),
    onSuccess: () => {
      refrescar(null);
      toast.success('Listo, se avisó que fue sin querer');
    },
    onError: (err) => toast.error(mensajeDeError(err)),
  });
  const [confirmando, setConfirmando] = useState(false);

  return (
    <Capa onCerrar={onCerrar}>
      <div className="space-y-4 p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-red-100 text-red-700">
            <Siren className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-slate-900">Alerta enviada</h2>
            <p className="text-sm text-slate-500">{formatFechaHora(e.createdAt)}</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar: la alerta sigue activa"
            title="Cerrar (la alerta sigue activa)"
            className="grid size-10 shrink-0 place-items-center rounded-full text-slate-500 active:bg-slate-100"
          >
            <X className="size-5" />
          </button>
        </div>

        {e.acusadaPor ? (
          <p className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-900 ring-1 ring-emerald-200 ring-inset">
            <CircleCheck className="mt-0.5 size-4 shrink-0" />
            {e.acusadaPor} recibió tu alerta y va en camino.
          </p>
        ) : (
          <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200 ring-inset">
            Avisamos a tu supervisor y a administración. Esperando que alguien la reciba…
            {e.escaladas > 0 && ' Se repitió la alerta a todos.'}
          </p>
        )}
        {e.lat == null && (
          <p className="flex items-start gap-2 text-xs text-slate-500">
            <MapPin className="mt-0.5 size-3.5 shrink-0" /> No se pudo tomar tu ubicación; avisa dónde estás.
          </p>
        )}

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">¿Qué pasa? (opcional)</p>
          <div className="flex flex-wrap gap-1.5">
            {TIPOS_EMERGENCIA.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={e.tipo === t}
                disabled={tipo.isPending}
                onClick={() => tipo.mutate(t)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset',
                  e.tipo === t ? 'bg-red-600 text-white ring-red-600' : 'bg-white text-slate-600 ring-slate-300',
                )}
              >
                {TIPO_EMERGENCIA_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        <Marcador supervisor={e.supervisor} />

        {confirmando ? (
          <div className="space-y-2 rounded-lg bg-slate-50 p-3">
            <p className="text-sm text-slate-700">¿Seguro que fue sin querer? Se avisará a quienes recibieron la alerta.</p>
            <div className="flex gap-2">
              <Button className="flex-1" loading={cancelar.isPending} onClick={() => cancelar.mutate()}>
                Sí, fue sin querer
              </Button>
              <Button className="flex-1" variant="secondary" onClick={() => setConfirmando(false)}>
                No
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" className="w-full" onClick={() => setConfirmando(true)}>
            Fue sin querer
          </Button>
        )}
        <p className="text-center text-xs text-slate-400">
          Necesita internet. Si estás en peligro, no esperes: usa también tu radio o el 911.
        </p>
      </div>
    </Capa>
  );
}
