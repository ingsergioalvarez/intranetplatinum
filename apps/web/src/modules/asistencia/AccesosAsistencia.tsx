import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRightLeft,
  CalendarDays,
  CalendarOff,
  CalendarRange,
  ChevronDown,
  FileText,
  HandHelping,
  LayoutGrid,
  Route,
  ScanFace,
  ShieldAlert,
  Siren,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import { Modal, cn } from '../../components/ui';
import { hoyLocal } from '../../core/format/fechas';
import { ausenciasService } from '../ausencias/ausencias.service';
import { cambiosService } from '../cambios/cambios.service';
import { casosService } from '../casos/casos.service';
import { coberturaService } from '../cobertura/cobertura.service';
import { rangoProximos } from '../cobertura/estados';
import { emergenciasService } from '../emergencias/emergencias.service';
import { horasExtraService } from '../horas-extra/horasExtra.service';
import { solicitudesService } from '../solicitudes/solicitudes.service';
import { asistenciaService } from './asistencia.service';

type Tono = 'rojo' | 'ambar';

/** Una sección a la que se llega desde Asistencia, con el número de lo que espera atención. */
interface Acceso {
  clave: string;
  etiqueta: string;
  icono: LucideIcon;
  /** Enlace a otra pantalla; sin él, `alPulsar` abre una ventana (Horarios en PDF). */
  to?: string;
  alPulsar?: () => void;
  n: number;
  tono: Tono;
  grupo: 'atender' | 'consultar';
}

/**
 * Lo que sale de Asistencia (A-84): una sola lista con el número de pendientes de cada sección, para mostrarla como
 * una fila de tarjetas en computadora y como un solo botón que abre una hoja en el celular. Usa las mismas consultas
 * (y refrescos) de siempre. "Casos de cobertura" y "Solicitudes de cobertura" solo aparecen si hay alguno.
 */
function useAccesos(alAbrirHorario: () => void): Acceso[] {
  const mes = hoyLocal().slice(0, 7);
  const incidencias = useQuery({
    queryKey: asistenciaService.keys.incidenciasPorGuardia(mes),
    queryFn: () => asistenciaService.incidenciasPorGuardia(mes),
    refetchInterval: 60_000,
  });
  const rostros = useQuery({
    queryKey: asistenciaService.keys.pendientes,
    queryFn: asistenciaService.rostrosPendientes,
    refetchInterval: 60_000,
  });
  const cambios = useQuery({
    queryKey: cambiosService.keys.list({ estado: 'pendiente', page: 1, limit: 1 }),
    queryFn: () => cambiosService.list({ estado: 'pendiente', page: 1, limit: 1 }),
    refetchInterval: 60_000,
  });
  const horasExtra = useQuery({
    queryKey: horasExtraService.keys.list({ estado: 'pendientes', page: 1, limit: 1 }),
    queryFn: () => horasExtraService.list({ estado: 'pendientes', page: 1, limit: 1 }),
    refetchInterval: 60_000,
  });
  const casos = useQuery({ queryKey: casosService.keys.lista, queryFn: casosService.lista, refetchInterval: 60_000 });
  const solicitudes = useQuery({
    queryKey: solicitudesService.keys.lista,
    queryFn: solicitudesService.lista,
    refetchInterval: 60_000,
  });
  const emergencias = useQuery({
    queryKey: emergenciasService.keys.activas,
    queryFn: () => emergenciasService.lista('activas'),
    refetchInterval: 10_000,
  });
  const ausencias = useQuery({ queryKey: ausenciasService.keys.lista, queryFn: ausenciasService.lista, refetchInterval: 60_000 });
  const rango = rangoProximos(hoyLocal());
  const calendario = useQuery({
    queryKey: coberturaService.keys.resumen(rango),
    queryFn: () => coberturaService.resumen(rango),
    refetchInterval: 60_000,
  });

  const accesos: (Acceso | null)[] = [
    {
      clave: 'incidencias',
      etiqueta: 'Incidencias',
      icono: ShieldAlert,
      to: '/asistencia/incidencias',
      n: incidencias.data?.reduce((t, f) => t + f.pendientes, 0) ?? 0,
      tono: 'rojo',
      grupo: 'atender',
    },
    { clave: 'rostros', etiqueta: 'Rostros por revisar', icono: ScanFace, to: '/asistencia/rostros', n: rostros.data?.length ?? 0, tono: 'ambar', grupo: 'atender' },
    { clave: 'cambios', etiqueta: 'Cambios de turno', icono: ArrowRightLeft, to: '/asistencia/cambios', n: cambios.data?.pendientes ?? 0, tono: 'ambar', grupo: 'atender' },
    { clave: 'horas', etiqueta: 'Horas extra', icono: Timer, to: '/asistencia/horas-extra', n: horasExtra.data?.pendientes ?? 0, tono: 'ambar', grupo: 'atender' },
    // Aparecen cuando hay un guardia esperando a su relevo o una solicitud abierta.
    casos.data && casos.data.items.length > 0
      ? { clave: 'casos', etiqueta: 'Casos de cobertura', icono: Route, to: '/asistencia/casos', n: casos.data.pendientes ?? 0, tono: 'rojo', grupo: 'atender' }
      : null,
    solicitudes.data && solicitudes.data.items.length > 0
      ? { clave: 'solicitudes', etiqueta: 'Solicitudes de cobertura', icono: HandHelping, to: '/asistencia/solicitudes', n: solicitudes.data.pendientes ?? 0, tono: 'rojo', grupo: 'atender' }
      : null,
    { clave: 'emergencias', etiqueta: 'Emergencias', icono: Siren, to: '/asistencia/emergencias', n: emergencias.data?.activas ?? 0, tono: 'rojo', grupo: 'atender' },
    { clave: 'ausencias', etiqueta: 'Ausencias', icono: CalendarOff, to: '/asistencia/ausencias', n: ausencias.data?.pendientes ?? 0, tono: 'rojo', grupo: 'atender' },
    { clave: 'calendario', etiqueta: 'Calendario', icono: CalendarDays, to: '/asistencia/calendario', n: calendario.data?.sinCubrir ?? 0, tono: 'rojo', grupo: 'consultar' },
    { clave: 'horarios', etiqueta: 'Horarios (PDF)', icono: CalendarRange, alPulsar: alAbrirHorario, n: 0, tono: 'rojo', grupo: 'consultar' },
    { clave: 'reportes', etiqueta: 'Reportes', icono: FileText, to: '/asistencia/reportes', n: 0, tono: 'rojo', grupo: 'consultar' },
  ];
  return accesos.filter((a): a is Acceso => a !== null);
}

const TONO_TARJETA: Record<Tono, string> = {
  rojo: 'bg-red-50 text-red-800 ring-red-200 hover:bg-red-100',
  ambar: 'bg-amber-50 text-amber-900 ring-amber-200 hover:bg-amber-100',
};
const TONO_NUMERO: Record<Tono, string> = { rojo: 'bg-red-600', ambar: 'bg-amber-600' };

function Numero({ n, tono, className }: { n: number; tono: Tono; className?: string }) {
  return (
    <span
      className={cn('flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs leading-none font-semibold text-white', TONO_NUMERO[tono], className)}
      aria-label={`${n} pendientes`}
    >
      {n > 99 ? '99+' : n}
    </span>
  );
}

/** Computadora: una fila de tarjetas iguales (baja a más filas si la ventana es angosta). */
function Tarjetas({ accesos }: { accesos: Acceso[] }) {
  const clase = (a: Acceso) =>
    cn(
      'relative flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-center text-xs font-medium ring-1 ring-inset transition-colors',
      a.n > 0 ? TONO_TARJETA[a.tono] : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50',
    );
  const contenido = (a: Acceso) => (
    <>
      <a.icono className="size-5" aria-hidden />
      <span className="leading-tight">{a.etiqueta}</span>
      {a.n > 0 && <Numero n={a.n} tono={a.tono} className="absolute top-1.5 right-1.5" />}
    </>
  );
  return (
    <ul className="mb-4 hidden grid-cols-[repeat(auto-fit,minmax(6.75rem,1fr))] gap-2 md:grid">
      {accesos.map((a) => (
        <li key={a.clave}>
          {a.to ? (
            <Link to={a.to} className={clase(a)}>
              {contenido(a)}
            </Link>
          ) : (
            <button type="button" onClick={a.alPulsar} className={clase(a)}>
              {contenido(a)}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

const GRUPOS: { grupo: Acceso['grupo']; titulo: string }[] = [
  { grupo: 'atender', titulo: 'Por atender' },
  { grupo: 'consultar', titulo: 'Consultar' },
];

/** Celular: un solo botón con el total de pendientes que abre una hoja con todas las secciones. */
function BotonSecciones({ accesos }: { accesos: Acceso[] }) {
  const [abierta, setAbierta] = useState(false);
  const total = accesos.reduce((t, a) => t + a.n, 0);
  return (
    <div className="mb-4 md:hidden">
      <button
        type="button"
        onClick={() => setAbierta(true)}
        aria-haspopup="dialog"
        className="flex h-12 w-full items-center gap-3 rounded-xl bg-white px-4 text-left text-sm font-semibold text-slate-800 ring-1 ring-slate-300 ring-inset active:bg-slate-50"
      >
        <LayoutGrid className="size-5 text-slate-500" aria-hidden />
        <span className="flex-1">Secciones</span>
        {total > 0 && <Numero n={total} tono="rojo" />}
        <ChevronDown className="size-4 text-slate-500" aria-hidden />
      </button>
      <Modal open={abierta} onClose={() => setAbierta(false)} title="Secciones de asistencia" size="sm">
        <div className="-mx-2 space-y-3">
          {GRUPOS.map(({ grupo, titulo }) => {
            const items = accesos.filter((a) => a.grupo === grupo);
            if (items.length === 0) return null;
            return (
              <section key={grupo} aria-label={titulo}>
                <h3 className="px-3 pb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">{titulo}</h3>
                <ul className="space-y-1">
                  {items.map((a) => {
                    const fila = 'flex h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-base font-medium text-slate-700 active:bg-slate-100';
                    const interior = (
                      <>
                        <a.icono className="size-5 text-slate-500" aria-hidden />
                        <span className="flex-1">{a.etiqueta}</span>
                        {a.n > 0 && <Numero n={a.n} tono={a.tono} />}
                      </>
                    );
                    return (
                      <li key={a.clave}>
                        {a.to ? (
                          <Link to={a.to} onClick={() => setAbierta(false)} className={fila}>
                            {interior}
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setAbierta(false);
                              a.alPulsar?.();
                            }}
                            className={fila}
                          >
                            {interior}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}

/** Accesos de Asistencia (A-84): tarjetas en computadora y un solo botón "Secciones" en el celular. */
export function AccesosAsistencia({ alAbrirHorario }: { alAbrirHorario: () => void }) {
  const accesos = useAccesos(alAbrirHorario);
  return (
    <>
      <Tarjetas accesos={accesos} />
      <BotonSecciones accesos={accesos} />
    </>
  );
}
