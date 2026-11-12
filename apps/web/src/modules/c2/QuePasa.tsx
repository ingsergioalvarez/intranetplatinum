import { NotebookPen } from 'lucide-react';
import type { GuardiaC2, SitioC2 } from '@platinum/shared';
import { cn } from '../../components/ui';
import { formatHora } from '../asistencia/formato';
import { Avatar } from '../clientes/AsignarTurnoModal';
import { ESTILO } from './c2.estilos';

/** Una línea de la columna "Qué pasa": quién falta (con la hora a la que debía entrar) o quién está (con su foto). */
function LineaGuardia({ g, estado }: { g: GuardiaC2; estado: SitioC2['estado'] }) {
  const esperando = !g.presente && estado === 'por_llegar';
  const titulo = g.presente ? g.nombre : `${esperando ? 'Debe entrar' : 'Falta'}: ${g.nombre}`;
  const detalle = g.presente
    ? `Entró ${formatHora(g.entrada!)}${g.horario ? ` · turno ${formatHora(g.horario.entrada)}–${formatHora(g.horario.salida)}` : ''}`
    : g.horario
      ? `${esperando ? 'entra a las' : 'debía entrar a las'} ${formatHora(g.horario.entrada)} · turno ${formatHora(g.horario.entrada)}–${formatHora(g.horario.salida)}`
      : 'sin horario';
  return (
    <div className="flex items-center gap-3">
      <Avatar foto={g.foto} nombre={g.nombre} />
      <div className="min-w-0">
        <p className={cn('truncate text-sm font-semibold', g.presente ? 'text-slate-900' : esperando ? ESTILO.por_llegar.texto : ESTILO.solo.texto)}>
          {titulo}
        </p>
        <p className="text-xs text-slate-500">{detalle}</p>
      </div>
    </div>
  );
}

/** La columna "Qué pasa" de un sitio. Los que faltan van primero: es lo que importa. */
export function QuePasa({ sitio }: { sitio: SitioC2 }) {
  if (sitio.guardias.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-2">
        <span className="text-sm text-slate-400">Nadie asignado a esta hora</span>
        <UltimaNota sitio={sitio} />
      </div>
    );
  }
  const orden = [...sitio.guardias].sort((a, b) => Number(a.presente) - Number(b.presente));
  return (
    <div className="grid grid-cols-1 gap-2">
      {orden.map((g) => (
        <LineaGuardia key={`${g.id}:${g.horario?.entrada ?? ''}`} g={g} estado={sitio.estado} />
      ))}
      <UltimaNota sitio={sitio} />
    </div>
  );
}

/** La última nota que el C2 dejó hoy sobre el sitio: quien releva el turno sabe qué ya se hizo. */
function UltimaNota({ sitio }: { sitio: SitioC2 }) {
  const n = sitio.ultimaNota;
  if (!n) return null;
  return (
    <p className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900 ring-1 ring-amber-200 ring-inset">
      <NotebookPen className="mt-0.5 size-3 shrink-0" aria-hidden />
      <span>
        <strong>{n.autor}</strong> {formatHora(n.en)}: {n.texto}
      </span>
    </p>
  );
}
